/**
 * The map page: MapLibre GL JS (pinned build from a CDN, checked by its hash) and a small renderer driven by
 * messages. Native apps show it in react-native-webview (MapSurface.tsx), the web in an iframe (MapSurface.web.tsx),
 * so every platform runs the same map code. (Expo DOM components are not an option: Android Expo Go 57 crashes on
 * them.) Labels are in Polish where OpenStreetMap has a Polish name. The attribution (OpenStreetMap's licence
 * requires it) sits bottom left, above `bottomInset` (a panel over the map's lower edge); a still preview starts
 * with it folded.
 * Messages in: init (the style and data), data (new GeoJSON for the sources), fly (move the view).
 * Out: ready, press (a pin, by feature id), tap (the map elsewhere, when `tapToCenter`), move (the centre after a
 * move; `user` when the user moved it), error.
 */
const MAPLIBRE = "https://unpkg.com/maplibre-gl@5.24.0/dist";
const SCRIPT_SRI = "sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp";
const STYLE_SRI = "sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK";

const PAGE_SCRIPT = `
(function () {
  var send = function (message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.parent.postMessage(text, "*");
  };
  var map = null;
  var spec = null;
  var loaded = false;
  function addData() {
    map.getStyle().layers.forEach(function (layer) {
      spec.recolor.forEach(function (rule) {
        if (layer.type === rule.type && new RegExp(rule.match).test(layer.id)) map.setPaintProperty(layer.id, rule.prop, rule.value);
      });
      if (layer.type === "symbol" && !spec.labels) return map.setLayoutProperty(layer.id, "visibility", "none");
      var label = layer.type === "symbol" && map.getLayoutProperty(layer.id, "text-field");
      if (label && JSON.stringify(label).indexOf("name") >= 0) map.setLayoutProperty(layer.id, "text-field", spec.labelField);
    });
    if (!spec.interactive) {
      var attribution = document.querySelector(".maplibregl-ctrl-attrib");
      if (attribution) attribution.classList.remove("maplibregl-compact-show");
    }
    Object.keys(spec.sources).forEach(function (id) { map.addSource(id, spec.sources[id]); });
    spec.layers.forEach(function (layer) { map.addLayer(layer); });
    spec.pressable.forEach(function (id) {
      map.on("mouseenter", id, function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, function () { map.getCanvas().style.cursor = ""; });
    });
    loaded = true;
  }
  function onClick(e) {
    var hit = spec.pressable.length ? map.queryRenderedFeatures(e.point, { layers: spec.pressable }) : [];
    if (hit.length) return send({ type: "press", id: String(hit[0].properties.id) });
    if (!spec.tapToCenter) return;
    map.easeTo({ center: e.lngLat, duration: 400 });
    send({ type: "tap", lat: e.lngLat.lat, lng: e.lngLat.lng });
  }
  function init(next) {
    spec = next;
    map = new maplibregl.Map({
      container: "map",
      style: spec.style,
      center: spec.center,
      zoom: spec.zoom,
      interactive: spec.interactive,
      attributionControl: false,
    });
    if (spec.monochrome) document.getElementById("map").style.filter = "grayscale(1)";
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    document.querySelector(".maplibregl-ctrl-bottom-left").style.marginBottom = spec.bottomInset + "px";
    map.on("load", addData);
    map.on("click", onClick);
    map.on("moveend", function (e) {
      var c = map.getCenter();
      send({ type: "move", lat: c.lat, lng: c.lng, user: Boolean(e.originalEvent) });
    });
    map.on("error", function (e) { send({ type: "error", message: String(e.error && e.error.message) }); });
  }
  window.__receive = function (m) {
    if (m.type === "init" && !map) init(m.spec);
    if (m.type === "data" && spec) {
      Object.keys(m.sources).forEach(function (id) {
        spec.sources[id] = m.sources[id];
        if (loaded) map.getSource(id).setData(m.sources[id].data);
      });
    }
    if (m.type === "fly" && map) map.easeTo({ center: m.center, zoom: m.zoom || map.getZoom(), duration: 600 });
  };
  window.addEventListener("message", function (e) {
    if (typeof e.data === "string") window.__receive(JSON.parse(e.data));
  });
  send(typeof maplibregl === "undefined" ? { type: "error", message: "maplibre-gl did not load" } : { type: "ready" });
})();
`;

export const MAP_HTML = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css" integrity="${STYLE_SRI}" crossorigin="anonymous">
<style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden}</style>
</head><body><div id="map"></div>
<script src="${MAPLIBRE}/maplibre-gl.js" integrity="${SCRIPT_SRI}" crossorigin="anonymous"></script>
<script>${PAGE_SCRIPT}</script>
</body></html>`;
