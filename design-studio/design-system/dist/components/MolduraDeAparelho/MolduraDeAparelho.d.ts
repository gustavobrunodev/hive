import React from "react";
import "./MolduraDeAparelho.css";
export type MolduraDeAparelhoProps = {
    /** O nome da tela ("Revisar"). */
    nome: string;
    /** Mostra "· em foco" em `acento-tinta`. */
    emFoco?: boolean;
    /** `criando` mostra o esqueleto; `na-fila` esmaece o frame. */
    estado?: "pronto" | "criando" | "na-fila";
    /** Texto depois do nome quando o agente está trabalhando ("Claude está desenhando…"). */
    legenda?: string;
    /** `celular` (390×780) ou `desktop` (janela 1040×680). */
    dispositivo?: "celular" | "desktop";
    /** Endereço mostrado na barra da janela de desktop. */
    url?: string;
    /** Pulsa uma vez um anel laranja: o agente acabou de mudar esta tela. */
    realce?: boolean;
    /** O conteúdo da tela: o Protótipo, com o design system do cliente. */
    children?: React.ReactNode;
    className?: string;
};
/** O frame onde cada tela do Protótipo vive no canvas. */
export declare function MolduraDeAparelho({ nome, emFoco, estado, legenda, dispositivo, url, realce, children, className, }: MolduraDeAparelhoProps): React.JSX.Element;
