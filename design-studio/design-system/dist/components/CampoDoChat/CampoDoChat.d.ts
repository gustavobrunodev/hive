import React from "react";
import { type Fonte } from "../ChipDeFonte/ChipDeFonte";
import "./CampoDoChat.css";
export type Citacao = {
    id: string;
    fonte: Fonte;
    titulo: string;
};
export type CampoDoChatProps = {
    valor: string;
    aoMudar: (texto: string) => void;
    /** Chamado pelo botão de enviar ou por Enter (Shift+Enter quebra a linha). */
    aoEnviar: (envio: {
        texto: string;
        citacoes: Citacao[];
    }) => void;
    /** Dores citadas com @, mostradas acima do texto. */
    citacoes?: Citacao[];
    aoRemoverCitacao?: (id: string) => void;
    /** Seletores à esquerda, depois do botão de anexar (Protótipo). */
    seletores?: React.ReactNode;
    /** Seletor à direita, antes do microfone (agente e modelo). */
    agente?: React.ReactNode;
    /** Mostra o botão de anexar. */
    aoAnexar?: () => void;
    /** Mostra o microfone. */
    aoGravar?: () => void;
    gravando?: boolean;
    placeholder?: string;
    /** Nome acessível do campo. Padrão "Mensagem para o agente". */
    rotulo?: string;
    /** `inicio` (grande, no Início) ou `compacto` (vista de trabalho). */
    tamanho?: "inicio" | "compacto";
    className?: string;
};
/** O campo onde a pessoa conversa com o agente. */
export declare function CampoDoChat({ valor, aoMudar, aoEnviar, citacoes, aoRemoverCitacao, seletores, agente, aoAnexar, aoGravar, gravando, placeholder, rotulo, tamanho, className, }: CampoDoChatProps): React.JSX.Element;
