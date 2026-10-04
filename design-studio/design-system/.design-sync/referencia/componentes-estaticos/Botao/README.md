# Botao

Botões diretos e táteis do estúdio: primário laranja, secundário em superfície, terciário transparente, mais o botão redondo de enviar e o botão só de ícone.

## Use
- **`btn btn-pri`**: a ação principal de uma área, uma por vez (Gerar Variantes, Inserir, Enviar). Fundo `acento`, texto `sobre-acento`; hover `acento-hover`, clique `acento-press`.
- **`btn btn-sec`**: a alternativa ao lado da principal (Descartar, Desfazer). Fundo `superficie`, borda `borda-forte`, sombra `sombra-1`.
- **`btn btn-ter`**: ações de baixo peso dentro de um painel (Limpar filtro). Transparente, hover em `superficie-3`.
- **`btn-p`** junto de qualquer variante: versão pequena para rodapés de painel (padding 6px 11px, 0.875rem, canto `raio-m`).
- **`btn-icone`**: fechar, voltar, histórico. Sempre com `aria-label`.
- **`cmp-enviar`**: círculo laranja de 38px no canto do campo do chat; desabilitado vira `superficie-3`.

## O consumidor fornece
O `<button>` com as classes, o rótulo (estilo `botao`, Geist 600) e, se houver, um ícone do conjunto com classe `ic` antes do texto.

## Estados
Foco: contorno de 2px em `tinta`, afastado 2px. Clique: desce 1px. Desabilitado: opacidade 0.5.

## Não
- Nunca texto branco sobre laranja.
- Nunca dois primários lado a lado.
- O texto em `acento-press` fica em 4,04:1 no claro: o estado dura só o clique, não o use parado.
