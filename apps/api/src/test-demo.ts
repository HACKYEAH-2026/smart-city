import type { Database, GeoLocation } from "@app/plugin-sdk";
import type { PlaceKind } from "@app/shared";
import { Hono } from "hono";
import { type RecordId, surql } from "surrealdb";
import type { Auth } from "./auth";
import { type Db, first, geoPoint, keyOf, membershipRef, ref, rows, visitRef } from "./db";
import type { PluginHost } from "./plugins/host";
import { createPluginDb } from "./services/db/service";
import type { FileService } from "./services/files/service";
import {
  builtinPlugin,
  DEMO_ADMIN,
  DEMO_COMMUNITY,
  DEMO_RESIDENT,
  PUBLIC_AND_OPEN,
  seedDemoResident,
  seededCommunity,
} from "./test-routes";

/**
 * The local demo's content (dev API and E2E only; never import from production code): the people of Kraków and of
 * the Tauron Arena, and what they wrote with the built-in plugins. Kraków is the main place of the demo: the city
 * office answers residents' reports, publishes announcements and joins discussions. The Tauron Arena is a venue
 * during an event (HackYeah): the venue's announcements, reports from the hall and the attendees' discussions.
 * Made-up people, reports and posts on real addresses (points looked up once with Photon); dates are relative to
 * the seed, so a fresh database always looks current.
 */

type Account = { email: string; password: string; name: string };
const person = (email: string, name: string): Account => ({ email, password: "password", name });

/** The Tauron Arena's admin: the venue's staff. */
export const DEMO_ARENA_ADMIN = person("admin@arena.test", "Tauron Arena Kraków");

/** Everyone in the demo besides the two admins (password "password"); the first nine write most of the content. */
const PEOPLE = {
  anna: DEMO_RESIDENT,
  piotr: person("piotr@krakow.test", "Piotr Wiśniewski"),
  kasia: person("kasia@krakow.test", "Katarzyna Lewandowska"),
  marek: person("marek@krakow.test", "Marek Zieliński"),
  ola: person("ola@krakow.test", "Aleksandra Kamińska"),
  tomasz: person("tomasz@krakow.test", "Tomasz Wójcik"),
  ewa: person("ewa@krakow.test", "Ewa Dąbrowska"),
  michal: person("michal@krakow.test", "Michał Kowalczyk"),
  julia: person("julia@krakow.test", "Julia Mazur"),
  krzysztof: person("krzysztof.nowicki@krakow.test", "Krzysztof Nowicki"),
  agnieszka: person("agnieszka.pawlak@krakow.test", "Agnieszka Pawlak"),
  pawel: person("pawel.michalski@krakow.test", "Paweł Michalski"),
  magdalena: person("magdalena.krol@krakow.test", "Magdalena Król"),
  lukasz: person("lukasz.wieczorek@krakow.test", "Łukasz Wieczorek"),
  joanna: person("joanna.jablonska@krakow.test", "Joanna Jabłońska"),
  grzegorz: person("grzegorz.wrobel@krakow.test", "Grzegorz Wróbel"),
  monika: person("monika.nowakowska@krakow.test", "Monika Nowakowska"),
  adam: person("adam.majewski@krakow.test", "Adam Majewski"),
  natalia: person("natalia.olszewska@krakow.test", "Natalia Olszewska"),
  rafal: person("rafal.stepien@krakow.test", "Rafał Stępień"),
  barbara: person("barbara.malinowska@krakow.test", "Barbara Malinowska"),
  wojciech: person("wojciech.jaworski@krakow.test", "Wojciech Jaworski"),
  karolina: person("karolina.adamczyk@krakow.test", "Karolina Adamczyk"),
  dariusz: person("dariusz.dudek@krakow.test", "Dariusz Dudek"),
  beata: person("beata.gorecka@krakow.test", "Beata Górecka"),
  // Attendees of the event in the arena who are not members of Kraków.
  kuba: person("kuba@krakow.test", "Jakub Szymański"),
  zosia: person("zosia@krakow.test", "Zofia Kaczmarek"),
  mateusz: person("mateusz@krakow.test", "Mateusz Zając"),
  wiktoria: person("wiktoria@krakow.test", "Wiktoria Krawczyk"),
} satisfies Record<string, Account>;
type Person = keyof typeof PEOPLE;
/** A person, or the place's admin (the city office in Kraków, the venue in the arena). */
type Author = Person | "admin";

/** Minutes before the seed ran. */
type Ago = number;
const minutes = (n: number): Ago => n;
const hours = (n: number): Ago => n * 60;
const days = (n: number): Ago => n * 24 * 60;

/** Photos of the reports: the ads' generated stills (demo-video/src/ads/shared/media.ts, disclosed in README.md). */
const PHOTOS = {
  chodnik: new URL("../../../demo-video/public/ad/images/chodnik.jpg", import.meta.url),
  latarnia: new URL("../../../demo-video/public/ad/images/latarnia.jpg", import.meta.url),
};

type DemoIssue = {
  title: string;
  description: string;
  where: GeoLocation;
  by: Person;
  ago: Ago;
  /** Only admins see it; none = "Inne". */
  category?: string;
  anonymous?: boolean;
  photo?: keyof typeof PHOTOS;
  /** How many people voted it up: the reporter, those who joined it, `voters`, then other members. */
  votes: number;
  /** Who voted besides the reporter (the demo resident's votes are only these). */
  voters?: Person[];
  /** Residents whose report of the same problem was joined to this one (they follow it). */
  joined?: { by: Person; ago: Ago; description: string }[];
  comments?: { by: Author; ago: Ago; text: string }[];
  /** The admins' answer to members. */
  reply?: { ago: Ago; text: string };
  /** The admins' internal note. */
  note?: string;
  closed?: { ago: Ago; note?: string };
  /** The admin has not opened it yet (counted as new in the admin panel). */
  unseen?: boolean;
};
type DemoAnnouncement = { title: string; body: string; ago: Ago };
type DemoDiscussion = {
  title: string;
  body: string;
  by: Author;
  ago: Ago;
  locked?: boolean;
  /** In order; `replyTo` is the index of an earlier message of the same discussion. */
  messages: { by: Author; ago: Ago; text: string; replyTo?: number }[];
};
type DemoPlace = {
  slug: string;
  admin: Account;
  /** Plain members, all but the admin; each joined between `joined[0]` and `joined[1]` ago. */
  members: Person[];
  joined: [Ago, Ago];
  announcements: DemoAnnouncement[];
  /**
   * Every category the reports use, added when missing (an installation older than the plugin's default categories
   * has none); `replaceCategories` first removes the plugin's defaults.
   */
  issues: { categories: string[]; replaceCategories?: boolean; items: DemoIssue[] };
  discussions: DemoDiscussion[];
  /** When a member last opened a plugin (what is "new" on the dashboard). */
  visits?: { who: Person; plugin: "issues" | "announcements" | "discussions"; ago: Ago }[];
};

/**
 * The second place of the demo: a real venue (address and point from OpenStreetMap), on the map and open to anyone.
 * Announcements first: during an event they matter most.
 */
export const DEMO_ARENA = {
  slug: "tauron-arena",
  name: "Tauron Arena Kraków",
  kind: "other" satisfies PlaceKind,
  address: "Stanisława Lema 7, 31-571 Kraków",
  description: "Ogłoszenia dla uczestników wydarzeń, zgłoszenia z hali i rozmowy na miejscu.",
  invite_code: "TAURON",
  lat: 50.06772,
  lng: 19.99155,
  pluginIds: ["announcements", "issues", "discussions"],
};

const KRAKOW_RESIDENTS: Person[] = [
  "anna",
  "piotr",
  "kasia",
  "marek",
  "ola",
  "tomasz",
  "ewa",
  "michal",
  "julia",
  "krzysztof",
  "agnieszka",
  "pawel",
  "magdalena",
  "lukasz",
  "joanna",
  "grzegorz",
  "monika",
  "adam",
  "natalia",
  "rafal",
  "barbara",
  "wojciech",
  "karolina",
  "dariusz",
  "beata",
];

const KRAKOW: DemoPlace = {
  slug: DEMO_COMMUNITY.slug,
  admin: DEMO_ADMIN,
  members: KRAKOW_RESIDENTS,
  joined: [days(240), days(20)],
  announcements: [
    {
      title: "Remont torowiska na Krakowskiej: tramwaje jadą objazdem",
      body: "Od poniedziałku do odwołania tramwaje nie kursują ulicą Krakowską między placem Wolnica a mostem Piłsudskiego i jadą objazdem przez ul. Starowiślną. Na tym odcinku kursuje zastępcza komunikacja autobusowa, a przystanki zastępcze są oznaczone żółtymi tabliczkami. Utrudnienia potrwają około trzech tygodni.",
      ago: hours(5),
    },
    {
      title: "Alert smogowy: ogranicz aktywność na zewnątrz",
      body: "Na jutro prognozowane jest przekroczenie poziomu informowania dla pyłu PM10. Ogranicz spacery i sport na zewnątrz, szczególnie z dziećmi i osobami starszymi, i nie wietrz mieszkania wieczorem. W dniu alertu kierowcy z dowodem rejestracyjnym pojazdu jeżdżą komunikacją miejską bezpłatnie. Przypominamy, że w Krakowie obowiązuje zakaz palenia węglem i drewnem.",
      ago: days(1) + hours(2),
    },
    {
      title: "Wystawka: odbiór mebli i dużych odpadów w Nowej Hucie",
      body: "W sobotę od 7:00 odbieramy meble, materace, dywany i duży sprzęt z wyznaczonych miejsc na osiedlach Nowej Huty. Odpady wystaw w piątek wieczorem przy altanach śmietnikowych. Nie odbieramy gruzu, opon ani elektroodpadów: te oddasz bezpłatnie w Punkcie Selektywnej Zbiórki Odpadów Komunalnych (PSZOK).",
      ago: days(2) + hours(4),
    },
    {
      title: "Konsultacje: jesienne nasadzenia na Plantach",
      body: "Zapraszamy na spotkanie o jesiennych nasadzeniach drzew i krzewów na Plantach: w czwartek o 17:30 w sali obrad Urzędu Miasta, pl. Wszystkich Świętych 3-4. Propozycje możesz też zostawić w dyskusji „Nasadzenia na Plantach: Wasze propozycje” w zakładce Dyskusje.",
      ago: days(4),
    },
    {
      title: "Dłuższe godziny pracy punktów obsługi mieszkańców",
      body: "W poniedziałki punkty obsługi mieszkańców przy al. Powstania Warszawskiego 10 i na os. Zgody 2 są czynne do 18:00. Sprawy dowodów osobistych, rejestracji pojazdów i meldunku załatwisz także po pracy. Na wizytę możesz umówić się przez internet.",
      ago: days(6),
    },
    {
      title: "Bezpłatne szczepienia przeciw grypie dla seniorów",
      body: "Mieszkańcy Krakowa po 65. roku życia mogą bezpłatnie zaszczepić się przeciw grypie w przychodniach podstawowej opieki zdrowotnej, które biorą udział w miejskim programie. Zapytaj w swojej przychodni i zabierz dowód osobisty.",
      ago: days(9),
    },
    {
      title: "Sprzątasz z sąsiadami? Damy worki i rękawice",
      body: "Organizujesz sprzątanie skweru, podwórka albo brzegu rzeki? Zgłoś akcję co najmniej tydzień wcześniej, a przygotujemy worki i rękawice i odbierzemy zebrane śmieci. Napisz w zakładce Dyskusje albo zadzwoń do Wydziału Gospodarki Komunalnej.",
      ago: days(13),
    },
  ],
  issues: {
    categories: ["Drogi i chodniki", "Oświetlenie", "Czystość", "Zieleń", "Komunikacja miejska", "Rowery"],
    items: [
      {
        title: "Za krótkie zielone światło dla pieszych przy placu Inwalidów",
        description:
          "Na przejściu przez Aleje przy placu Inwalidów zielone dla pieszych trwa kilka sekund. Osoby starsze i rodzice z wózkami zostają na środku jezdni, gdy samochody już ruszają.",
        where: { address: "plac Inwalidów, 30-045 Kraków", lat: 50.06952, lng: 19.92553 },
        by: "marek",
        ago: days(9),
        category: "Drogi i chodniki",
        votes: 23,
        voters: ["anna"],
        comments: [
          { by: "ewa", ago: days(8) + hours(4), text: "Moja mama nie zdąża przejść na raz, zawsze czeka na wysepce." },
          { by: "julia", ago: days(8), text: "Z wózkiem to samo, a do tego przycisk reaguje z opóźnieniem." },
          {
            by: "michal",
            ago: days(6),
            text: "Może dałoby się wydłużyć zielone chociaż poza godzinami szczytu?",
          },
          { by: "marek", ago: days(2), text: "Czy jest już wynik analizy?" },
        ],
        reply: {
          ago: days(5),
          text: "Zgłoszenie przekazaliśmy do analizy w Zarządzie Dróg Miasta Krakowa. Inżynier ruchu sprawdzi długość faz sygnalizacji w tym tygodniu, a o wyniku poinformujemy tutaj.",
        },
        note: "Analiza faz sygnalizacji: termin do końca miesiąca.",
      },
      {
        title: "Zapadnięty chodnik i dziura z wodą przy Długiej 50",
        description:
          "Płyty chodnika przy wejściu do sklepu zapadły się, a po deszczu stoi tam kałuża na pół chodnika. Wieczorem łatwo się potknąć, wczoraj starsza pani prawie się przewróciła.",
        where: { address: "Długa 50, 31-146 Kraków", lat: 50.07007, lng: 19.93682 },
        by: "piotr",
        ago: days(3) + hours(2),
        category: "Drogi i chodniki",
        photo: "chodnik",
        votes: 14,
        voters: ["anna"],
        joined: [{ by: "ewa", ago: days(2), description: "To samo miejsce, kałuża stoi tam po każdym deszczu." }],
        comments: [
          {
            by: "kasia",
            ago: days(2) + hours(20),
            text: "Potwierdzam, wczoraj wieczorem wjechałam tam kołem wózka i ledwo go wyciągnęłam.",
          },
          {
            by: "marek",
            ago: days(2) + hours(5),
            text: "Kilka metrów dalej, przy bramie pod 46, płyty też się ruszają.",
          },
          { by: "piotr", ago: days(1) + hours(3), text: "Dzięki za szybką odpowiedź, dam znać, jak naprawią." },
        ],
        reply: {
          ago: days(1) + hours(6),
          text: "Dziękujemy za zgłoszenie. Przekazaliśmy je do Zarządu Dróg Miasta Krakowa: miejsce zostało zabezpieczone, a wymiana płyt jest zaplanowana w ciągu dwóch tygodni.",
        },
        note: "ZDMK potwierdził zlecenie. Za dwa tygodnie sprawdzić też płyty przy bramie pod 46.",
      },
      {
        title: "Nie świeci latarnia przy przystanku na Witosa",
        description:
          "Latarnia obok przystanku autobusowego nie świeci od tygodnia. Wieczorem na przystanku jest zupełnie ciemno, a sporo osób czeka tam na nocne autobusy.",
        where: { address: "Wincentego Witosa 39, 30-612 Kraków", lat: 50.01218, lng: 19.95431 },
        by: "ewa",
        ago: days(6),
        category: "Oświetlenie",
        photo: "latarnia",
        votes: 9,
        joined: [{ by: "anna", ago: days(4), description: "Druga latarnia za przejściem też miga." }],
        comments: [
          {
            by: "tomasz",
            ago: days(5) + hours(1),
            text: "Wracam tędy codziennie po 22, rzeczywiście jest kompletnie ciemno.",
          },
        ],
      },
      {
        title: "Brak stojaków rowerowych przy bibliotece na Rajskiej",
        description:
          "Przy Wojewódzkiej Bibliotece Publicznej rowery są przypinane do barierek i drzew, bo nie ma żadnych stojaków. Przydałoby się kilka stojaków w kształcie odwróconego U.",
        where: { address: "Rajska 1, 31-124 Kraków", lat: 50.06495, lng: 19.92944 },
        by: "ola",
        ago: days(12),
        category: "Rowery",
        votes: 18,
        voters: ["anna"],
        comments: [
          { by: "piotr", ago: days(11), text: "Popieram, w sesji nie ma gdzie przypiąć roweru." },
          {
            by: "kasia",
            ago: days(10) + hours(2),
            text: "Miejsce na stojaki jest po lewej stronie wejścia, przy trawniku.",
          },
        ],
      },
      {
        title: "Korzenie podniosły asfalt na ścieżce rowerowej na Bulwarze Wołyńskim",
        description:
          "Na ścieżce rowerowej wzdłuż Wisły korzenie drzew podniosły asfalt w kilku miejscach. Przy szybszej jeździe, zwłaszcza po zmroku, łatwo się wywrócić.",
        where: { address: "Bulwar Wołyński, 31-051 Kraków", lat: 50.04917, lng: 19.93358 },
        by: "michal",
        ago: days(5),
        category: "Rowery",
        votes: 11,
        comments: [
          {
            by: "ola",
            ago: days(4) + hours(6),
            text: "Najgorzej jest tuż przed Mostem Grunwaldzkim, widziałam tam już wywrotkę.",
          },
        ],
      },
      {
        title: "Gruz i stare meble przy wjeździe do ogródków działkowych",
        description:
          "Ktoś wyrzucił worki z gruzem, stare szafki i opony przy wjeździe do ogródków działkowych od Bulwarowej. Sterta rośnie z każdym dniem.",
        where: { address: "Bulwarowa 35, 31-978 Kraków", lat: 50.0814, lng: 20.04781 },
        by: "tomasz",
        anonymous: true,
        ago: days(2) + hours(5),
        category: "Czystość",
        votes: 7,
      },
      {
        title: "Połamane ławki na Plantach przy Barbakanie",
        description:
          "Dwie ławki przy alejce między Barbakanem a Bramą Floriańską mają połamane deski w oparciu. Z jednej wystaje gwóźdź.",
        where: { address: "Basztowa, 31-157 Kraków", lat: 50.06547, lng: 19.94164 },
        by: "kasia",
        ago: days(4) + hours(3),
        category: "Zieleń",
        votes: 6,
        reply: {
          ago: days(3),
          text: "Dziękujemy. Ławki są oznaczone taśmą, a naprawę zleciliśmy Zarządowi Zieleni Miejskiej.",
        },
      },
      {
        title: "Wybita szyba w wiacie przystanku Teatr Bagatela",
        description:
          "W wiacie przystanku tramwajowego w stronę placu Inwalidów wybita jest boczna szyba. Szkło leży na chodniku i przy ławce.",
        where: { address: "Karmelicka 6, 31-128 Kraków", lat: 50.06367, lng: 19.93251 },
        by: "julia",
        ago: hours(20),
        category: "Komunikacja miejska",
        votes: 5,
        comments: [{ by: "michal", ago: hours(16), text: "Szkło dalej leży przy ławce, uważajcie z psami." }],
        unseen: true,
      },
      {
        title: "Nie działa winda w przejściu pod Dworcem Głównym",
        description:
          "Winda z przystanku tramwajowego Dworzec Główny Tunel na poziom ulicy stoi od rana. Osoby na wózkach i rodzice z wózkami nie mają jak wyjść z tunelu.",
        where: { address: "Dworzec Główny Tunel, 31-508 Kraków", lat: 50.0682, lng: 19.94774 },
        by: "kasia",
        ago: hours(7),
        category: "Komunikacja miejska",
        votes: 4,
        comments: [{ by: "anna", ago: hours(5), text: "Potwierdzam, w południe dalej nie działała." }],
        unseen: true,
      },
      {
        title: "Zatkane liśćmi studzienki na Królewskiej",
        description:
          "Po wczorajszym deszczu przy przejściu dla pieszych stoi duża kałuża, bo studzienki są zasypane liśćmi. Samochody ochlapują ludzi na chodniku.",
        where: { address: "Królewska 57, 30-081 Kraków", lat: 50.07398, lng: 19.91579 },
        by: "agnieszka",
        ago: hours(12),
        category: "Czystość",
        votes: 3,
        unseen: true,
      },
      {
        title: "Przepełnione kosze na Bulwarze Czerwieńskim",
        description:
          "W weekendy kosze na bulwarach pod Wawelem są pełne już w sobotę rano, a śmieci roznoszą wiatr i ptaki.",
        where: { address: "Bulwar Czerwieński, 31-104 Kraków", lat: 50.05503, lng: 19.92929 },
        by: "anna",
        ago: days(16),
        category: "Czystość",
        votes: 12,
        comments: [
          { by: "marek", ago: days(15), text: "W niedzielę wieczorem było to samo." },
          { by: "anna", ago: days(9), text: "W ostatni weekend było czysto, dziękuję!" },
        ],
        reply: {
          ago: days(13),
          text: "Od tego tygodnia kosze na Bulwarze Czerwieńskim są opróżniane dwa razy dziennie, także w soboty i niedziele. Dziękujemy za zgłoszenie!",
        },
        closed: { ago: days(12) },
      },
      {
        title: "Nie działa przycisk na przejściu przy Kalwaryjskiej 40",
        description:
          "Przycisk dla pieszych nie reaguje: zielone się nie zapala i trzeba czekać na kolejny cykl albo przechodzić na czerwonym.",
        where: { address: "Kalwaryjska 40, 30-513 Kraków", lat: 50.04175, lng: 19.94315 },
        by: "anna",
        ago: days(10),
        category: "Drogi i chodniki",
        votes: 5,
        reply: { ago: days(8), text: "Serwis sygnalizacji wymienił przycisk. Dziękujemy!" },
        closed: { ago: days(7) },
      },
      {
        title: "Graffiti na elewacji kamienicy przy Józefa 12",
        description: "Ktoś zamalował sprayem świeżo odnowioną elewację kamienicy i drzwi do bramy.",
        where: { address: "Józefa 12, 31-056 Kraków", lat: 50.05062, lng: 19.94417 },
        by: "marek",
        ago: days(20),
        category: "Czystość",
        votes: 4,
        closed: { ago: days(14), note: "Elewację oczyściła ekipa miejska." },
      },
      {
        title: "Suche drzewo przy placu zabaw w Parku Lotników Polskich",
        description:
          "Przy placu zabaw stoi uschnięte drzewo, a przy wietrze spadają z niego gałęzie. Bawią się tam małe dzieci.",
        where: { address: "Park Lotników Polskich, Kraków", lat: 50.06954, lng: 19.99371 },
        by: "tomasz",
        ago: days(25),
        category: "Zieleń",
        votes: 15,
        reply: {
          ago: days(22),
          text: "Arborysta Zarządu Zieleni Miejskiej potwierdził, że drzewo jest martwe. Wytniemy je w tym tygodniu, a wiosną posadzimy w tym miejscu nowe.",
        },
        closed: { ago: days(18), note: "Drzewo usunięte, teren uprzątnięty." },
      },
    ],
  },
  discussions: [
    {
      title: "Objazd tramwajów przez Starowiślną: jak dojeżdżacie?",
      body: "Od kiedy tramwaje nie jeżdżą Krakowską, dojazd z Podgórza do centrum zajmuje mi dwa razy dłużej. Macie sprawdzone sposoby?",
      by: "michal",
      ago: hours(4),
      messages: [
        {
          by: "ola",
          ago: hours(3) + minutes(30),
          text: "Rowerem przez kładkę Bernatka i bulwarami, 12 minut do Rynku.",
        },
        {
          by: "tomasz",
          ago: hours(3),
          text: "Autobus zastępczy jeździ co kilka minut, ale w szczycie stoi w korku na Starowiślnej.",
        },
        { by: "michal", ago: hours(2), text: "Dzięki, chyba wyciągnę rower z piwnicy.", replyTo: 0 },
        {
          by: "anna",
          ago: minutes(50),
          text: "Ja wysiadam na Wawrzyńca i idę pieszo przez Kazimierz, wychodzi podobnie.",
        },
      ],
    },
    {
      title: "Sprzątanie Parku Jordana w sobotę: kto się dołącza?",
      body: "Po lecie w parku i przy stawie zostało sporo śmieci. Proponuję wspólne sprzątanie w sobotę o 10:00, zbiórka przy wejściu od al. 3 Maja. Worki i rękawice załatwię przez urząd.",
      by: "kasia",
      ago: days(3) + hours(1),
      messages: [
        { by: "piotr", ago: days(3), text: "Wpadam! Mogę wziąć dwa chwytaki do śmieci." },
        {
          by: "ewa",
          ago: days(2) + hours(20),
          text: "Przyjdę z wnukami, będą zachwyceni. Ile to mniej więcej potrwa?",
        },
        {
          by: "kasia",
          ago: days(2) + hours(19),
          text: "Myślę, że około dwóch godzin. Kto będzie miał siłę, może zostać na kawę w parku.",
          replyTo: 1,
        },
        {
          by: "admin",
          ago: days(2) + hours(3),
          text: "Dziękujemy za inicjatywę! Worki i rękawice będą do odbioru w piątek w Wydziale Gospodarki Komunalnej przy al. Powstania Warszawskiego 10. Pełne worki zostawcie przy bramie od al. 3 Maja, a MPO zabierze je w poniedziałek rano.",
        },
        { by: "julia", ago: hours(9), text: "Super, będę z koleżanką z roku." },
        { by: "marek", ago: hours(3), text: "Dołączę koło 11, wcześniej mam trening." },
      ],
    },
    {
      title: "Gdzie oddać stary telewizor i zużyte baterie?",
      body: "Po przeprowadzce mamy w piwnicy stary telewizor, czajnik i sporo baterii. Czy można je wystawić na wystawkę?",
      by: "ewa",
      ago: days(2),
      messages: [
        {
          by: "marek",
          ago: days(1) + hours(22),
          text: "Elektroodpadów nie można wystawiać na wystawkę. Oddasz je bezpłatnie w PSZOK, a mały sprzęt przyjmuje też część sklepów z elektroniką.",
        },
        {
          by: "anna",
          ago: days(1) + hours(20),
          text: "Baterie wrzucisz do pojemnika w większości marketów i w szkołach.",
        },
        { by: "ewa", ago: days(1) + hours(18), text: "Dziękuję, w sobotę zawiozę wszystko do PSZOK." },
      ],
    },
    {
      title: "Nasadzenia na Plantach: Wasze propozycje",
      body: "Zbieramy pomysły przed czwartkowym spotkaniem konsultacyjnym. Jakie drzewa i krzewy chcielibyście na Plantach i gdzie brakuje Wam cienia?",
      by: "admin",
      ago: days(4),
      messages: [
        {
          by: "kasia",
          ago: days(3) + hours(22),
          text: "Więcej ławek w cieniu od strony Wawelu, latem nie da się tam usiąść.",
        },
        { by: "piotr", ago: days(3) + hours(20), text: "Lipy zamiast kolejnych klonów, w czerwcu pięknie pachną." },
        {
          by: "ewa",
          ago: days(3) + hours(4),
          text: "I krzewy przy alejkach od strony Dworca, żeby mniej było słychać ulicę.",
        },
        {
          by: "julia",
          ago: days(2),
          text: "Może łąka kwietna zamiast trawnika w jednym kwartale? Dla pszczół i mniej koszenia.",
        },
        {
          by: "admin",
          ago: days(1) + hours(5),
          text: "Dziękujemy, łąki kwietne dopiszemy do tematów spotkania.",
          replyTo: 3,
        },
      ],
    },
    {
      title: "Stacje rowerów miejskich na Kazimierzu",
      body: "Czy ktoś wie, czy przy placu Nowym będzie znowu stacja rowerów miejskich? Wcześniej jeździłam nimi na uczelnię.",
      by: "ola",
      ago: days(9),
      messages: [
        {
          by: "michal",
          ago: days(8) + hours(20),
          text: "Słyszałem, że system ma się rozrastać w przyszłym roku, ale szczegółów nie znam.",
        },
        { by: "tomasz", ago: days(8), text: "Warto dopisać to do konsultacji, wtedy jest szansa, że ktoś to policzy." },
        { by: "ola", ago: days(7), text: "Dobry pomysł, dopiszę." },
      ],
    },
    {
      title: "Hałas nocny na Kazimierzu w weekendy",
      body: "Mieszkam przy Szerokiej i w weekendy do trzeciej w nocy nie da się spać. Czy ktoś próbował coś z tym zrobić?",
      by: "marek",
      ago: days(12),
      locked: true,
      messages: [
        { by: "kasia", ago: days(11) + hours(20), text: "To centrum miasta, trochę hałasu jest wliczone." },
        { by: "marek", ago: days(11) + hours(18), text: "Trochę tak, ale nie co weekend do trzeciej.", replyTo: 0 },
        {
          by: "admin",
          ago: days(11),
          text: "Prosimy o rzeczowe wpisy bez wskazywania konkretnych lokali. Zakłócanie ciszy nocnej zgłaszaj Straży Miejskiej pod numerem 986: patrol przyjedzie na miejsce. Zamykamy dyskusję.",
        },
      ],
    },
  ],
  visits: [
    { who: "anna", plugin: "issues", ago: days(1) },
    { who: "anna", plugin: "announcements", ago: days(2) + hours(12) },
    { who: "anna", plugin: "discussions", ago: days(1) },
  ],
};

/** Places in the hall: the reports' points (inside the arena) and addresses. */
const inArena = (address: string, dLat: number, dLng: number): GeoLocation => ({
  address: `Tauron Arena Kraków, ${address}`,
  lat: Number((DEMO_ARENA.lat + dLat).toFixed(5)),
  lng: Number((DEMO_ARENA.lng + dLng).toFixed(5)),
});

const ARENA: DemoPlace = {
  slug: DEMO_ARENA.slug,
  admin: DEMO_ARENA_ADMIN,
  members: [
    "anna",
    "piotr",
    "ola",
    "michal",
    "julia",
    "tomasz",
    "krzysztof",
    "agnieszka",
    "pawel",
    "magdalena",
    "lukasz",
    "joanna",
    "grzegorz",
    "monika",
    "kuba",
    "zosia",
    "mateusz",
    "wiktoria",
  ],
  joined: [hours(23), hours(21)],
  announcements: [
    {
      title: "Witamy na HackYeah w Tauron Arenie!",
      body: "Identyfikatory odbierzesz w punkcie rejestracji przy wejściu B od ul. Lema. Najbliższy przystanek tramwajowy to Tauron Arena Kraków Wieczysta. Ogłoszenia obsługi hali znajdziesz tutaj, a usterki zgłaszaj w zakładce Zgłoszenia.",
      ago: hours(22),
    },
    {
      title: "Zasady bezpieczeństwa w hali",
      body: "Drogi ewakuacyjne są oznaczone na zielono: nie stawiaj na nich krzeseł, plecaków ani kolejek. Punkt medyczny jest przy wejściu C, a obsługa w żółtych kamizelkach jest w każdym sektorze. W razie alarmu idź za wskazówkami obsługi.",
      ago: hours(21),
    },
    {
      title: "Wi-Fi dla uczestników",
      body: "Połącz się z siecią HackYeah-Arena, hasło jest na odwrocie identyfikatora. Jeśli w Twoim sektorze sieć jest słaba, zgłoś to w zakładce Zgłoszenia i podaj numer sektora.",
      ago: hours(15),
    },
    {
      title: "Prąd przy stołach",
      body: "Każdy stół ma listwę zasilającą. Jeśli Twoja nie działa, zgłoś to w zakładce Zgłoszenia z numerem stołu: technicy podchodzą na bieżąco. Nie łącz przedłużaczy w łańcuch i nie podłączaj czajników ani grzejników.",
      ago: hours(11),
    },
    {
      title: "Śniadanie od 7:30 w strefie gastronomicznej",
      body: "Kawa, herbata i śniadanie czekają na płycie głównej w strefie gastronomicznej od 7:30 do 10:00. Porcje wegańskie i bezglutenowe wydajemy w osobnym okienku. Pokaż identyfikator przy wydawaniu.",
      ago: hours(7),
    },
    {
      title: "Strefa ciszy w sektorach F i G",
      body: "Jeśli chcesz się przespać, idź do strefy ciszy w sektorach F i G na poziomie +1. Wycisz telefon i nie rozmawiaj przy śpiących. Śpiwory i karimaty rozkładaj tylko w tej strefie, nie na przejściach.",
      ago: hours(4),
    },
    {
      title: "Szatnia przy wejściu B czynna do końca wydarzenia",
      body: "Szatnia przy wejściu B działa bez przerwy do końca wydarzenia. Walizki i duże plecaki zostawisz w przechowalni obok punktu informacji na poziomie 0.",
      ago: hours(1),
    },
  ],
  issues: {
    categories: ["Wi-Fi i prąd", "Toalety", "Jedzenie i napoje", "Czystość", "Bezpieczeństwo"],
    replaceCategories: true,
    items: [
      {
        title: "Słabe Wi-Fi w sektorze D",
        description:
          "W górnych rzędach sektora D sieć HackYeah-Arena co chwilę się rozłącza. Nie da się wypchnąć commita ani pobrać paczek.",
        where: inArena("sektor D", 0.0002, 0.0005),
        by: "ola",
        ago: hours(9),
        category: "Wi-Fi i prąd",
        votes: 12,
        voters: ["anna"],
        joined: [{ by: "michal", ago: hours(8) + minutes(40), description: "Rzędy 18–22 bez sieci." }],
        comments: [
          { by: "michal", ago: hours(7) + minutes(30), text: "Jest lepiej, ale w ostatnich rzędach dalej rwie." },
          { by: "julia", ago: hours(7), text: "U nas od pół godziny stabilnie, dzięki!" },
          { by: "mateusz", ago: hours(6), text: "Sektor E też ma słaby zasięg, zwłaszcza przy schodach." },
        ],
        reply: {
          ago: hours(8),
          text: "Dostawiliśmy punkt dostępowy nad sektorem D. Dajcie znać w komentarzach, czy jest lepiej.",
        },
      },
      {
        title: "Kolejka do kawy blokuje przejście ewakuacyjne",
        description: "Kolejka do ekspresu przy sektorze B stoi w poprzek przejścia oznaczonego jako droga ewakuacyjna.",
        where: inArena("poziom 0, przy sektorze B", -0.0002, 0.0004),
        by: "michal",
        ago: hours(3),
        category: "Bezpieczeństwo",
        votes: 6,
        comments: [
          {
            by: "lukasz",
            ago: hours(2) + minutes(30),
            text: "Może taśma na podłodze, która pokaże, gdzie ma stać kolejka?",
          },
        ],
      },
      {
        title: "Brak papieru i mydła w toalecie przy sektorze A",
        description: "W męskiej toalecie przy sektorze A od godziny nie ma papieru ani mydła.",
        where: inArena("poziom 0, przy sektorze A", -0.0003, -0.0004),
        by: "kuba",
        anonymous: true,
        ago: hours(2),
        category: "Toalety",
        votes: 5,
        unseen: true,
      },
      {
        title: "Rozlana kawa na schodach do strefy ciszy",
        description: "Na schodach z płyty do sektorów F i G ktoś rozlał kawę i jest bardzo ślisko.",
        where: inArena("schody do sektorów F i G", 0.0003, -0.0003),
        by: "julia",
        ago: minutes(40),
        category: "Bezpieczeństwo",
        votes: 2,
        unseen: true,
      },
      {
        title: "Nie działa listwa zasilająca przy stole 42",
        description:
          "Listwa przy stole 42 nie daje prądu i cały zespół pracuje na bateriach. Przełącznik świeci, ale żadne gniazdko nie działa.",
        where: inArena("płyta główna, stół 42", 0, 0),
        by: "piotr",
        ago: hours(4),
        category: "Wi-Fi i prąd",
        votes: 3,
        comments: [{ by: "piotr", ago: hours(3) + minutes(10), text: "Działa, dzięki za błyskawiczną reakcję!" }],
        reply: {
          ago: hours(3) + minutes(30),
          text: "Technik wymienił listwę. Gdyby znowu nie działała, piszcie tutaj.",
        },
        closed: { ago: hours(3) + minutes(20) },
      },
      {
        title: "Zimno w strefie ciszy",
        description:
          "W strefie ciszy w sektorach F i G nawiew wieje zimnym powietrzem. Nie da się zasnąć nawet w bluzie.",
        where: inArena("strefa ciszy, sektory F i G", 0.0004, -0.0005),
        by: "anna",
        ago: hours(6),
        votes: 8,
        comments: [{ by: "zosia", ago: hours(4), text: "Dziękuję, koce uratowały mi noc." }],
        reply: {
          ago: hours(5),
          text: "Podnieśliśmy temperaturę nawiewu w sektorach F i G. Koce są do wzięcia w punkcie informacji na poziomie 0.",
        },
        closed: { ago: hours(4) + minutes(30) },
      },
      {
        title: "Za mało wegańskich porcji na kolacji",
        description:
          "Porcje wegańskie skończyły się po kwadransie, choć sporo osób zaznaczało tę dietę przy rejestracji.",
        where: inArena("strefa gastronomiczna", -0.0001, 0.0001),
        by: "tomasz",
        ago: hours(16),
        category: "Jedzenie i napoje",
        votes: 9,
        comments: [{ by: "wiktoria", ago: hours(15) + minutes(30), text: "Potwierdzam, o 21 już nic nie było." }],
        reply: {
          ago: hours(15),
          text: "Przepraszamy. Na śniadanie i obiad zamówiliśmy dodatkowe porcje wegańskie, wydajemy je w osobnym okienku.",
        },
        closed: { ago: hours(8) },
      },
    ],
  },
  discussions: [
    {
      title: "Ktoś pożyczy przejściówkę USB-C → HDMI?",
      body: "Musimy podpiąć laptopa do monitora, żeby przećwiczyć prezentację. Oddam w ciągu godziny.",
      by: "tomasz",
      ago: hours(2),
      messages: [
        { by: "piotr", ago: hours(1) + minutes(50), text: "Mam, stół 42. Podejdź." },
        { by: "tomasz", ago: hours(1) + minutes(45), text: "Dzięki, już idę!", replyTo: 0 },
      ],
    },
    {
      title: "Kawa o 7:30 przed próbą prezentacji?",
      body: "Po nocy kodowania przyda się kawa. Zbieramy się o 7:30 przy strefie gastronomicznej, potem razem na próbę prezentacji.",
      by: "wiktoria",
      ago: hours(5),
      messages: [
        { by: "ola", ago: hours(4) + minutes(30), text: "Będę, i tak nie śpię." },
        { by: "mateusz", ago: hours(4), text: "Ja też. Weźcie kubki, przy ekspresie ich brakuje." },
        { by: "admin", ago: hours(3) + minutes(30), text: "Kubki już są w strefie gastronomicznej. Smacznej kawy!" },
      ],
    },
    {
      title: "Otwarte dane o Krakowie: z czego korzystacie?",
      body: "Robimy projekt o komunikacji miejskiej i jakości powietrza w Krakowie. Z jakich źródeł danych korzystacie?",
      by: "piotr",
      ago: hours(12),
      messages: [
        {
          by: "kuba",
          ago: hours(11) + minutes(30),
          text: "Rozkłady jazdy miasto publikuje w formacie GTFS. My bierzemy z nich przystanki i odjazdy.",
        },
        {
          by: "wiktoria",
          ago: hours(11),
          text: "Jakość powietrza bierzemy ze stacji pomiarowych GIOŚ, mają otwarte API.",
        },
        {
          by: "piotr",
          ago: hours(10) + minutes(40),
          text: "Dzięki, GTFS to dokładnie to, czego szukaliśmy.",
          replyTo: 0,
        },
      ],
    },
    {
      title: "Szukamy osoby od frontendu (React Native)",
      body: "Robimy aplikację dla mieszkańców w kategorii Smart City. Mamy backend i projekt w Figmie, brakuje nam kogoś, kto zna Expo albo React Native. Siedzimy przy stole 17.",
      by: "michal",
      ago: hours(18),
      messages: [
        { by: "julia", ago: hours(17) + minutes(40), text: "Hej, piszę w Expo od roku. Mogę podejść za 10 minut?" },
        { by: "michal", ago: hours(17) + minutes(35), text: "Jasne, czekamy!", replyTo: 0 },
        {
          by: "zosia",
          ago: hours(17),
          text: "Jeśli dalej szukacie kogoś od UX, chętnie pomogę przy prezentacji.",
        },
        { by: "michal", ago: hours(16) + minutes(30), text: "Pewnie, przyda się świeże oko. Wpadaj!", replyTo: 2 },
      ],
    },
  ],
};

/** In this order: a person's default place is the first one they belong to. */
const DEMO_PLACES: DemoPlace[] = [KRAKOW, ARENA];

type DemoDeps = { db: Db; auth: Auth; plugins: PluginHost; files: FileService };

/** A place being seeded: who is who, the seed's clock and its plugins' tables as any author at any time. */
type PlaceSeed = {
  deps: DemoDeps;
  community: Awaited<ReturnType<typeof seededCommunity>>;
  /** User id of a person or of the place's admin. */
  id: (who: Author) => string;
  at: (ago: Ago) => Date;
  installationOf: (pluginId: string) => Promise<string>;
};

/** A plugin's table written as `by` (null: the system) with createdAt `at`. */
type Writer = (by: string | null, at: Date) => Database;

const table = (db: Database, name: string) => {
  const client = db[name];
  if (!client) throw new Error(`seed: no table ${name}`);
  return client;
};

/** The Tauron Arena with its plugins, on the map and open. An old pin with that slug (no members) becomes it. */
async function seedArena({ db, plugins }: DemoDeps) {
  const { lat, lng, pluginIds, ...fields } = DEMO_ARENA;
  const place = { ...fields, ...PUBLIC_AND_OPEN, location: geoPoint({ lat, lng }) };
  await db.query(
    surql`INSERT IGNORE INTO community ${place};
          UPDATE community MERGE ${place}
            WHERE slug = ${DEMO_ARENA.slug} AND id NOT IN (SELECT VALUE community FROM membership);`,
  );
  await plugins.ready();
  const community = await seededCommunity(db, DEMO_ARENA.slug);
  // One after another: the place's navigation lists plugins in the order they were enabled.
  for (const id of pluginIds) await plugins.enable(builtinPlugin(plugins, id), community);
}

/**
 * Everyone's account, found by email or created: user ids by email. Created as Better Auth's sign-up does, but with
 * one hash per password: a hash takes ~0.15 s, and the demo's 31 accounts share "password".
 */
async function seedPeople({ db, auth }: DemoDeps) {
  const accounts: Account[] = [DEMO_ADMIN, DEMO_ARENA_ADMIN, ...Object.values(PEOPLE)];
  const emails = accounts.map((a) => a.email);
  const existing = await rows<{ id: RecordId; email: string }>(
    db,
    surql`SELECT id, email FROM user WHERE email INSIDE ${emails};`,
  );
  const found = new Map(existing.map((u) => [u.email, keyOf(u.id)]));
  const missing = accounts.filter((a) => !found.has(a.email));
  const context = await auth.$context;
  const passwords = [...new Set(missing.map((a) => a.password))];
  const hashes = new Map(await Promise.all(passwords.map(async (p) => [p, await context.password.hash(p)] as const)));
  const created = await Promise.all(
    missing.map(async ({ email, name, password }) => {
      const user = await context.internalAdapter.createUser(
        { email, name, emailVerified: false },
        { method: "email-password" },
      );
      await context.internalAdapter.linkAccount({
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: hashes.get(password),
      });
      return [email, user.id] as const;
    }),
  );
  return new Map([...found, ...created]);
}

/**
 * The admin (the place is their default) and the members (their first place in DEMO_PLACES is the default);
 * memberships are only created, never reset.
 */
async function seedMembers(s: PlaceSeed, place: DemoPlace) {
  const defaultPlace = (who: Person) => DEMO_PLACES.find((p) => p.members.includes(who))?.slug;
  const [from, to] = place.joined;
  const step = (from - to) / Math.max(place.members.length - 1, 1);
  const member = (who: Author, role: "admin" | "user", isDefault: boolean, joined: Ago) => ({
    id: membershipRef(s.community.id, s.id(who)),
    community: ref("community", s.community.id),
    user: ref("user", s.id(who)),
    role,
    is_default: isDefault,
    joined_at: s.at(joined),
  });
  const rows = [
    member("admin", "admin", true, from + days(7)),
    ...place.members.map((who, i) => member(who, "user", defaultPlace(who) === place.slug, from - step * i)),
  ];
  await s.deps.db.query(surql`INSERT IGNORE INTO membership ${rows};`);
}

async function seedAnnouncements(s: PlaceSeed, items: DemoAnnouncement[], as: Writer) {
  if (await table(as(null, s.at(0)), "announcements").count()) return;
  const author = s.id("admin");
  for (const a of items) {
    await table(as(author, s.at(a.ago)), "announcements").insert({ title: a.title, body: a.body, author });
  }
}

async function seedDiscussions(s: PlaceSeed, items: DemoDiscussion[], as: Writer) {
  if (await table(as(null, s.at(0)), "discussions").count()) return;
  for (const d of items) {
    const lastActivity = Math.min(d.ago, ...d.messages.map((m) => m.ago));
    const discussion = await table(as(s.id(d.by), s.at(d.ago)), "discussions").insert({
      title: d.title,
      body: d.body,
      author: s.id(d.by),
      locked: d.locked ?? false,
      lastActivityAt: s.at(lastActivity),
    });
    const ids: string[] = [];
    for (const m of d.messages) {
      const message = await table(as(s.id(m.by), s.at(m.ago)), "messages").insert({
        discussion: discussion.id,
        author: s.id(m.by),
        text: m.text,
        replyTo: m.replyTo === undefined ? null : (ids[m.replyTo] ?? null),
      });
      ids.push(message.id);
    }
  }
}

/** Who voted: the reporter, who joined, the named voters, then other members (never the demo resident). */
const votersOf = (issue: DemoIssue, index: number, members: Person[]): Person[] => {
  const named = [...new Set([issue.by, ...(issue.joined ?? []).map((j) => j.by), ...(issue.voters ?? [])])];
  const others = members.filter((who) => who !== "anna" && !named.includes(who));
  const shift = (index * 5) % Math.max(others.length, 1);
  return [...named, ...others.slice(shift), ...others.slice(0, shift)].slice(0, Math.max(issue.votes, named.length));
};

/**
 * What the issues plugin would have sent the report's followers (reporter and who joined): the admins' reply and the
 * closing, read an hour later when older than half a day.
 */
const notificationsOf = (s: PlaceSeed, installation: string, issue: DemoIssue, issueId: string) => {
  const followers = [...new Set([issue.by, ...(issue.joined ?? []).map((j) => j.by)])];
  const events = [
    ...(issue.reply
      ? [
          {
            title: "Administrator odpowiedział na zgłoszenie",
            body: `${issue.title}: ${issue.reply.text}`,
            tone: "info",
            ago: issue.reply.ago,
          },
        ]
      : []),
    ...(issue.closed
      ? [{ title: "Zgłoszenie zamknięte", body: issue.title, tone: "success", ago: issue.closed.ago }]
      : []),
  ];
  return followers.flatMap((who) =>
    events.map(({ ago, ...event }) => ({
      ...event,
      user: ref("user", s.id(who)),
      community: ref("community", s.community.id),
      installation: ref("installation", installation),
      plugin: "issues",
      open: { type: "navigate", view: "detail", params: { id: issueId } },
      created_at: s.at(ago),
      ...(ago > hours(12) ? { read_at: s.at(ago - hours(1)) } : {}),
    })),
  );
};

async function seedIssue(
  s: PlaceSeed,
  ctx: { as: Writer; installation: string; members: Person[]; categoryId: (name?: string) => string | null },
  issue: DemoIssue,
  index: number,
) {
  const { as } = ctx;
  const reporter = s.id(issue.by);
  const admin = s.id("admin");
  const created = s.at(issue.ago);
  const row = await table(as(reporter, created), "issues").insert({
    title: issue.title,
    description: issue.description,
    anonymous: issue.anonymous ?? false,
    location: issue.where,
    reporter,
    categoryId: ctx.categoryId(issue.category),
    status: issue.closed ? "closed" : "open",
    reply: issue.reply?.text ?? "",
    replyAt: issue.reply ? s.at(issue.reply.ago) : null,
    note: issue.note ?? "",
  });
  if (issue.photo) {
    const data = await Bun.file(PHOTOS[issue.photo]).bytes();
    const file = await s.deps.files.upload({
      installationId: ctx.installation,
      userId: reporter,
      mime: "image/jpeg",
      data,
    });
    await table(as(reporter, created), "photos").insert({ issue: row.id, file, author: reporter, position: 0 });
  }
  for (const j of issue.joined ?? []) {
    await table(as(s.id(j.by), s.at(j.ago)), "reports").insert({
      issue: row.id,
      author: s.id(j.by),
      description: j.description,
    });
  }
  // Votes come in between the report and now (or its closing).
  const voters = votersOf(issue, index, ctx.members);
  const span = issue.ago - (issue.closed?.ago ?? 0);
  for (const [i, who] of voters.entries()) {
    const at = s.at(issue.ago - (span * i) / voters.length);
    await table(as(s.id(who), at), "votes").insert({ issue: row.id, voter: s.id(who) });
  }
  for (const c of issue.comments ?? []) {
    await table(as(s.id(c.by), s.at(c.ago)), "comments").insert({ issue: row.id, author: s.id(c.by), text: c.text });
  }
  if (issue.closed) {
    await table(as(admin, s.at(issue.closed.ago)), "statusLog").insert({
      issue: row.id,
      status: "closed",
      note: issue.closed.note ?? "",
    });
  }
  if (!issue.unseen) await table(as(admin, created), "seen").insert({ issue: row.id, viewer: admin });
  const notifications = notificationsOf(s, ctx.installation, issue, row.id);
  if (notifications.length) await s.deps.db.query(surql`INSERT INTO notification ${notifications} RETURN NONE;`);
}

async function seedIssues(s: PlaceSeed, place: DemoPlace, as: Writer) {
  const system = as(null, s.at(0));
  if (await table(system, "issues").count()) return;
  const { categories, replaceCategories, items } = place.issues;
  if (replaceCategories) await table(system, "categories").deleteMany({});
  for (const name of categories) await table(system, "categories").upsert({ name }, { on: ["name"] });
  const rows = await table(system, "categories").findMany({ limit: 100 });
  const categoryId = (name?: string) => {
    if (!name) return null;
    const row = rows.find((c) => c.name === name);
    if (!row) throw new Error(`seed: no category ${name} in ${place.slug}`);
    return String(row.id);
  };
  const installation = await s.installationOf("issues");
  const ctx = { as, installation, members: place.members, categoryId };
  for (const [i, issue] of items.entries()) await seedIssue(s, ctx, issue, i);
}

async function seedPlace(deps: DemoDeps, place: DemoPlace, ids: Map<string, string>, now: number) {
  const community = await seededCommunity(deps.db, place.slug);
  const id = (who: Author) => {
    const email = who === "admin" ? place.admin.email : PEOPLE[who].email;
    const userId = ids.get(email);
    if (!userId) throw new Error(`seed: no account ${email}`);
    return userId;
  };
  const installationOf = async (pluginId: string) => {
    const row = await first<{ id: RecordId }>(
      deps.db,
      surql`SELECT id FROM plugin_installation WHERE community = ${ref("community", community.id)} AND plugin = ${pluginId};`,
    );
    if (!row) throw new Error(`seed: ${pluginId} is not enabled in ${place.slug}`);
    return keyOf(row.id);
  };
  const s: PlaceSeed = { deps, community, id, at: (ago) => new Date(now - ago * 60_000), installationOf };
  const writer = async (pluginId: string): Promise<Writer> => {
    const plugin = builtinPlugin(deps.plugins, pluginId);
    const installation = await installationOf(pluginId);
    return (by, at) => createPluginDb(deps.db, plugin, installation, by, () => at);
  };

  await seedMembers(s, place);
  await seedAnnouncements(s, place.announcements, await writer("announcements"));
  await seedIssues(s, place, await writer("issues"));
  await seedDiscussions(s, place.discussions, await writer("discussions"));
  for (const v of place.visits ?? []) {
    const installation = await installationOf(v.plugin);
    await deps.db.query(
      surql`UPSERT ${visitRef(installation, id(v.who))}
            SET installation = ${ref("installation", installation)}, user = ${ref("user", id(v.who))}, at = ${s.at(v.ago)};`,
    );
  }
}

/**
 * Local dev only (idempotent, after seedDemo and seedDemoResident): the accounts, the Tauron Arena and the content of
 * Kraków and the arena. A plugin's content goes only into an installation where its table is still empty, so a dev
 * database keeps what people added; delete apps/api/.data for a fresh demo.
 */
export async function seedDemoContent(deps: DemoDeps) {
  const now = Date.now();
  const ids = await seedPeople(deps);
  await seedArena(deps);
  for (const place of DEMO_PLACES) await seedPlace(deps, place, ids, now);
}

/** `/__test/demo`: the whole local demo, as the dev API seeds it on start (E2E of the demo). */
export function createDemoRoutes(deps: DemoDeps) {
  return new Hono().post("/__test/demo", async (c) => {
    await seedDemoResident(deps);
    await seedDemoContent(deps);
    return c.json({ ok: true });
  });
}
