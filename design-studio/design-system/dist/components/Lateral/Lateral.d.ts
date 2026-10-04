import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./Lateral.css";
export type ItemDaLateral = {
    id: string;
    rotulo: string;
    icone: NomeDoIcone;
    href?: string;
};
export type RecenteDaLateral = {
    id: string;
    titulo: string;
    subtitulo: string;
    icone: NomeDoIcone;
    href?: string;
};
export type Tema = "claro" | "escuro";
export type LateralProps = {
    /** Itens principais (Início, Protótipos, Dores, Relatórios). */
    itens: ItemDaLateral[];
    /** Id do item da página atual (`aria-current="page"`). */
    atual?: string;
    aoNavegar?: (id: string) => void;
    /** O botão de começar ("Nova conversa"). */
    novo?: {
        rotulo: string;
        href?: string;
        aoClicar?: () => void;
    };
    recentes?: RecenteDaLateral[];
    /** Itens do rodapé (Configurações). */
    rodape?: ItemDaLateral[];
    tema?: Tema;
    aoMudarTema?: (tema: Tema) => void;
    conta?: {
        nome: string;
        papel: string;
        iniciais: string;
    };
    /** Mostra o selo "Dados de exemplo". Padrão `true`. */
    exemplo?: boolean;
    /** Só ícones, 68px. */
    recolhida?: boolean;
    /** Mostra o botão de recolher/abrir. */
    aoRecolher?: () => void;
    className?: string;
};
/** A barra lateral do app: marca, começar, navegação, Recentes, tema e conta. */
export declare function Lateral({ itens, atual, aoNavegar, novo, recentes, rodape, tema, aoMudarTema, conta, exemplo, recolhida, aoRecolher, className, }: LateralProps): React.JSX.Element;
