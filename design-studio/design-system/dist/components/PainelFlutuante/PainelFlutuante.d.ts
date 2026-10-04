import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./PainelFlutuante.css";
export type PainelFlutuanteProps = {
    /** Nome acessível do painel ("Inserir na tela Revisar"). */
    rotulo: string;
    icone?: NomeDoIcone;
    /** O alvo ("Depois do bloco “Beneficiário”"). */
    titulo: React.ReactNode;
    /** A tela e a Proposta ("Revisar · Proposta A"). */
    subtitulo?: React.ReactNode;
    /** Mostra o botão de fechar. */
    aoFechar?: () => void;
    /** Botões do rodapé; dividem a largura. */
    rodape?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
};
/** O painel de 300px do modo ao vivo (Editar, Inserir, Ajustar). Não é modal. */
export declare function PainelFlutuante({ rotulo, icone, titulo, subtitulo, aoFechar, rodape, className, style, children }: PainelFlutuanteProps): React.JSX.Element;
export type LinhaDoPainelProps = {
    /** O nome da escolha ("Onde", "Tamanho"). */
    rotulo: string;
    /** O controle, alinhado à direita (um `Segmentado` compacto). */
    children: React.ReactNode;
};
/** Uma linha "rótulo + controle" do corpo do painel. */
export declare function LinhaDoPainel({ rotulo, children }: LinhaDoPainelProps): React.JSX.Element;
export type SugestoesProps<T extends string> = {
    opcoes: readonly {
        valor: T;
        rotulo: string;
    }[];
    /** A sugestão marcada, ou `null`. */
    valor: T | null;
    aoMudar: (valor: T) => void;
    /** Nome acessível do grupo ("Sugestões"). */
    rotulo: string;
};
/** Grade de duas colunas de sugestões; a marcada fica invertida em `tinta`. */
export declare function Sugestoes<T extends string>({ opcoes, valor, aoMudar, rotulo }: SugestoesProps<T>): React.JSX.Element;
export type NavegacaoDeVariantesProps = {
    /** Índice começando em 1. */
    atual: number;
    total: number;
    /** O nome da Variante atual ("Aviso · Informativo"). */
    nome: string;
    aoAnterior: () => void;
    aoProxima: () => void;
};
/** "Variante 2 de 3" com as setas de anterior e próxima. */
export declare function NavegacaoDeVariantes({ atual, total, nome, aoAnterior, aoProxima }: NavegacaoDeVariantesProps): React.JSX.Element;
