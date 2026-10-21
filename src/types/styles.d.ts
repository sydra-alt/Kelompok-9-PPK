declare module '*.css' {
  const classNames: { readonly [className: string]: string };
  export default classNames;
}
