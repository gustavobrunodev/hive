Recorrência semana a semana de uma série: a Dor filtrada ou a categoria em foco.

## Use
Traço de 2px em `graf-enfase`, área em `graf-area` sob a série, grade horizontal de 1px em `borda`, linha de base em `borda-forte`, ponto e rótulo final com o último valor. A escala tem uns 4 passos (1, 2, 2,5 ou 5 × 10^k) e os rótulos das semanas se espaçam para ter ~52px cada, sem colidir. Mira vertical em `tinta-3` e dica flutuante (`elevada`, canto `raio`, `sombra-2`) que segue o ponteiro e vira de lado perto da borda.

## Teclado e leitor de tela
O desenho recebe foco: as setas, Home e End andam pelas semanas e Esc fecha a dica. Cada leitura é anunciada ("Semana de 23 set: 33 ligações, Cotação e taxas. 16% das 210 ligações do Relatório nesta semana.").

## O consumidor fornece
A `serie` (rótulo da semana, valor, total do Relatório), o `nomeDaSerie` e a `unidade`. Sem `largura`, o gráfico mede o contêiner. "Ver tabela" troca o desenho pela tabela gêmea.

## Não
Nunca eixo duplo: duas medidas viram dois gráficos.
