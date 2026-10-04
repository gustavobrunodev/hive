# ChipDeFonte

A marca da Fonte de uma Evidência (Likert, Voz do Cliente, FullStory) e o chip de Dor citada que a carrega.

## Use
- **`chip-fonte f-likert | f-voz | f-fullstory`**: círculo com o ícone da Fonte (estrela para Likert, fone para Voz do Cliente, cursor para FullStory) em `nota-tinta`, sobre `nota-likert`, `nota-voz` ou `nota-fullstory`. O nome da Fonte, quando aparece, vai ao lado, em texto.
- **`chip-dor`**: pill branco com o chip circular da Fonte à esquerda, o título da Dor truncado e um botão de remover de 18px (`chip-x`). Aparece no campo do chat e nas mensagens da pessoa quando uma Dor é citada com @.

## O consumidor fornece
A Fonte da Dor (decide a classe), o título e, no `chip-dor`, o `aria-label` do botão de remover ("Tirar a citação").

## Não
As cores das Fontes não servem para status, categoria ou decoração.
