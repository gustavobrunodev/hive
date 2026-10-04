declare module "*.css"
declare module "*.md?raw" {
  const conteudo: string
  export default conteudo
}
