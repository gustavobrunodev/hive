Os botões do estúdio: `Botao` em três variantes, `BotaoIcone` para ações só de ícone e `BotaoEnviar`, o círculo laranja do campo do chat.

## Use
- **`variante="primario"`**: a ação principal de uma área, uma por vez (Gerar Variantes, Inserir). Fundo `acento`, texto `sobre-acento`; hover `acento-hover`, clique `acento-press`.
- **`variante="secundario"`**: a alternativa ao lado da principal (Descartar, Desfazer). Fundo `superficie`, borda `borda-forte`, sombra `sombra-1`.
- **`variante="terciario"`**: ações de baixo peso dentro de um painel (Limpar filtro). Transparente, hover em `superficie-3`.
- **`tamanho="pequeno"`**: rodapés de painel (padding 6px 11px, 0.875rem, canto `raio-m`).
- **`BotaoIcone`**: fechar, recolher, histórico. O `rotulo` vira nome acessível e dica.
- **`BotaoEnviar`**: 38px no canto do campo do chat; desabilitado vira `superficie-3`.

## O consumidor fornece
O rótulo (estilo `botao`, Geist 600), o `icone` opcional antes dele e o `href` quando a ação navega. A ref vai para o elemento nativo, então o botão serve de gatilho de menu.

## Estados
Foco: contorno de 2px em `tinta`, afastado 2px. Clique: desce 1px. Desabilitado: opacidade 0.5.

## Não
- Nunca texto branco sobre laranja.
- Nunca dois primários lado a lado.
- O texto em `acento-press` fica em 4,04:1 no claro: o estado dura só o clique, não o use parado.
