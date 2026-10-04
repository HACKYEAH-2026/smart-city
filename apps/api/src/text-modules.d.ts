/** Markdown imported as text (`with { type: "text" }`): Bun inlines it, also into the production bundle. */
declare module "*.md" {
  const text: string;
  export default text;
}
