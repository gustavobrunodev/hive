import "./base.css"

// Fundamentos
export { cores, sombras, raios, espacos, layout, familias, estilosDeTexto, arquivosDeFonte, curva, paresDeContraste, excecoesDeContraste } from "./tokens/tokens"
export type { Tema, TokenDeCor, TokenDeSombra, TokenSimples, EstiloDeTexto, ArquivoDeFonte, ParDeContraste, ExcecaoDeContraste } from "./tokens/tokens"
export { razaoDeContraste, corNoTema } from "./tokens/contraste"
export { icones, nomesDosIcones } from "./icones/icones"
export type { NomeDoIcone } from "./icones/icones"
export { marcasDosAgentes } from "./marcas/marcas"
export type { Agente } from "./marcas/marcas"

// Marca e ícones
export { Icone } from "./components/Icone/Icone"
export type { IconeProps } from "./components/Icone/Icone"
export { Sinal, Marca } from "./components/Sinal/Sinal"
export type { SinalProps, MarcaProps } from "./components/Sinal/Sinal"

// Agentes
export { LogoDoAgente } from "./components/LogoDoAgente/LogoDoAgente"
export type { LogoDoAgenteProps } from "./components/LogoDoAgente/LogoDoAgente"

// Ações
export { Botao, BotaoIcone, BotaoEnviar } from "./components/Botao/Botao"
export type { BotaoProps, BotaoIconeProps, BotaoEnviarProps } from "./components/Botao/Botao"

// Seleção
export { Seletor } from "./components/Seletor/Seletor"
export type { SeletorProps } from "./components/Seletor/Seletor"
export { Segmentado } from "./components/Segmentado/Segmentado"
export type { SegmentadoProps, OpcaoSegmentada } from "./components/Segmentado/Segmentado"

// Rótulos
export { Pilula, PilulaDeImpacto, Tendencia } from "./components/Pilula/Pilula"
export type { PilulaProps, PilulaDeImpactoProps, TendenciaProps, TomDaPilula, NivelDeImpacto, DirecaoDaTendencia } from "./components/Pilula/Pilula"
export { ChipDeFonte, ChipDeDor, FONTES } from "./components/ChipDeFonte/ChipDeFonte"
export type { ChipDeFonteProps, ChipDeDorProps, Fonte } from "./components/ChipDeFonte/ChipDeFonte"
export { SeloExemplo } from "./components/SeloExemplo/SeloExemplo"
export type { SeloExemploProps } from "./components/SeloExemplo/SeloExemplo"

// Entrada
export { CampoDoChat } from "./components/CampoDoChat/CampoDoChat"
export type { CampoDoChatProps, Citacao } from "./components/CampoDoChat/CampoDoChat"

// Navegação
export { Lateral } from "./components/Lateral/Lateral"
export type { LateralProps, ItemDaLateral, RecenteDaLateral } from "./components/Lateral/Lateral"
export { AbasDeProposta } from "./components/AbasDeProposta/AbasDeProposta"
export type { AbasDePropostaProps, Proposta } from "./components/AbasDeProposta/AbasDeProposta"
export { BarraFlutuante, Ferramenta, SeparadorDeFerramenta } from "./components/BarraDeFerramentas/BarraDeFerramentas"
export type { BarraFlutuanteProps, FerramentaProps } from "./components/BarraDeFerramentas/BarraDeFerramentas"

// Quadro
export { NotaAutoadesiva } from "./components/NotaAutoadesiva/NotaAutoadesiva"
export type { NotaAutoadesivaProps } from "./components/NotaAutoadesiva/NotaAutoadesiva"
export { MolduraDeAparelho } from "./components/MolduraDeAparelho/MolduraDeAparelho"
export type { MolduraDeAparelhoProps } from "./components/MolduraDeAparelho/MolduraDeAparelho"
export { CursorDoAgente } from "./components/CursorDoAgente/CursorDoAgente"
export type { CursorDoAgenteProps } from "./components/CursorDoAgente/CursorDoAgente"

// Modo ao vivo
export { PainelFlutuante, LinhaDoPainel, Sugestoes, NavegacaoDeVariantes } from "./components/PainelFlutuante/PainelFlutuante"
export type { PainelFlutuanteProps, LinhaDoPainelProps, SugestoesProps, NavegacaoDeVariantesProps } from "./components/PainelFlutuante/PainelFlutuante"
export { MiraDeInsercao, VagaDeInsercao, PreviaDeInsercao } from "./components/Inserir/Inserir"
export type { MiraDeInsercaoProps, VagaDeInsercaoProps, PreviaDeInsercaoProps } from "./components/Inserir/Inserir"

// Conversa
export { MensagemDoAgente } from "./components/MensagemDoAgente/MensagemDoAgente"
export type { MensagemDoAgenteProps } from "./components/MensagemDoAgente/MensagemDoAgente"
export { MensagemDaPessoa } from "./components/MensagemDaPessoa/MensagemDaPessoa"
export type { MensagemDaPessoaProps } from "./components/MensagemDaPessoa/MensagemDaPessoa"
export { CartaoDeRevisao } from "./components/CartaoDeRevisao/CartaoDeRevisao"
export type { CartaoDeRevisaoProps, Achado } from "./components/CartaoDeRevisao/CartaoDeRevisao"

// Avisos
export { Toast } from "./components/Toast/Toast"
export type { ToastProps } from "./components/Toast/Toast"
export { BarraDeProgresso } from "./components/BarraDeProgresso/BarraDeProgresso"
export type { BarraDeProgressoProps } from "./components/BarraDeProgresso/BarraDeProgresso"

// Superfícies e dados
export { Painel } from "./components/Painel/Painel"
export type { PainelProps } from "./components/Painel/Painel"
export { FiltroDeGraficos } from "./components/FiltroDeGraficos/FiltroDeGraficos"
export type { FiltroDeGraficosProps, GrupoDeDores } from "./components/FiltroDeGraficos/FiltroDeGraficos"
export { GraficoDeBarras } from "./components/GraficoDeBarras/GraficoDeBarras"
export type { GraficoDeBarrasProps, CategoriaDoGrafico } from "./components/GraficoDeBarras/GraficoDeBarras"
export { GraficoDeLinha } from "./components/GraficoDeLinha/GraficoDeLinha"
export type { GraficoDeLinhaProps, PontoDaSerie } from "./components/GraficoDeLinha/GraficoDeLinha"
export { Insight, PainelDeInsights } from "./components/Insight/Insight"
export type { InsightProps, PainelDeInsightsProps } from "./components/Insight/Insight"

// Utilitários
export { cx } from "./utils/cx"
export { formatarNumero, porcentagem } from "./utils/numeros"
export { escalaBonita, passoDosRotulos } from "./utils/escala"
