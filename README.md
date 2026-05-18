# Snippet Injector Pro 🚀

[![GitHub release](https://img.shields.io/github/v/release/ldefabris/extensaoCTRV?label=Release&style=flat-square&color=6366f1)](https://github.com/ldefabris/extensaoCTRV/releases)
[![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Opera%20%7C%20Edge%20%7C%20Brave-blue?style=flat-square)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![GitHub stars](https://img.shields.io/github/stars/ldefabris/extensaoCTRV?style=flat-square&color=yellow&label=Stars)](https://github.com/ldefabris/extensaoCTRV/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![GitHub license](https://img.shields.io/github/license/ldefabris/extensaoCTRV?style=flat-square&color=4f46e5&label=License)](LICENSE)

Uma extensão poderosa para navegadores baseados em Chromium (Chrome, Opera, Edge, Brave) projetada para otimizar sua área de transferência e produtividade diária. Ela gerencia, organiza e injeta snippets de texto (modelos prontos) em qualquer campo de formulário da web de forma ágil, servindo como um completo gerenciador de clipboard para múltiplas linhas. Além de oferecer uma interface premium, conta com um inovador assistente visual de contagem de horas para sistemas de ponto eletrônico.

---

## 📥 Downloads & Instalação Rápida

Para facilitar o uso, disponibilizamos o pacote compilado pronto para instalação sem a necessidade de utilizar o Git.

### Opção A: Instalação Instantânea (Recomendado)
1. Acesse a pasta de lançamentos e baixe a versão estável em formato `.zip`:
   👉 [**Baixar Snippet Injector Pro v3.5.0 (.zip)**](releases/snippet-injector-pro-v3.5.0.zip)
2. Extraia o arquivo `.zip` em uma pasta de sua escolha.
3. Siga o passo a passo da seção **[Como Ativar no Navegador](#-como-ativar-no-navegador)** abaixo.

### Opção B: Clonando via Git (Desenvolvedores)
```bash
git clone https://github.com/ldefabris/extensaoCTRV.git
```

---

## ✨ Funcionalidades Principais

*   **Injeção Inteligente**: Um botão flutuante **"S"** discreto e elegante aparece posicionado nos cantos de campos de texto. Clique para abrir um menu inteligente e inserir seu snippet com um único clique.
*   **Duração e Expiração (TTL)**: Defina snippets temporários (5 min, 1h, 1d, 30d) que são limpos automaticamente em segundo plano quando expiram.
*   **Categorização por Tags**: Agrupe seus textos rápidos por categorias (ex: `RH`, `data`, `nClientes`) e filtre rapidamente no menu injetado ou no gerenciador principal.
*   **Gestão de Área de Transferência Avançada**: Controle múltiplas linhas de textos recorrentes para colagem sem perder o histórico do seu clipboard nativo do sistema.
*   **Assistente de Ponto Integrado (Timesheet)**: Monitora e calcula automaticamente o déficit de horas em cartões de ponto de sistemas compatíveis, exibindo um alerta visual em vermelho indicando o tempo exato restante para completar a jornada diária de 8 horas.
*   **Interface Premium**: Design moderno baseado em variáveis HSL, cantos arredondados suavizados, barra de rolagem inteligente customizada com isolamento de eventos (evita conflitos com sites como WhatsApp Web e telas de login complexas) e suporte a micro-animações.

---

## 📸 Demonstração Visual & Casos de Uso

Aqui você pode ver o assistente inteligente injetando snippets de forma integrada e o painel administrativo da extensão:

### 1. Injeção de Snippets com Filtro de Tags
![Menu de Snippets Flutuante](sample.png)

### 2. Painel de Gerenciamento da Extensão (Popup)
![Painel de Gerenciamento](sample2.png)

---

## 🛠️ Tecnologias Utilizadas

*   **Manifest V3**: A arquitetura de extensão mais moderna, segura e com alto desempenho do ecossistema Chromium.
*   **JavaScript (ES6+)**: Processamento assíncrono moderno e gerenciamento otimizado de estados.
*   **HTML5 & CSS3 Avançado**: Interface construída com variáveis CSS dinâmicas, Flexbox e animações fluidas.
*   **Chrome Storage API**: Persistência de dados local rápida e segura.
*   **Observers do DOM (MutationObserver & ResizeObserver)**: Monitoramento em tempo real do DOM para se adaptar a layouts dinâmicos e redimensionáveis em Single Page Applications (React, Vue, Angular e WhatsApp Web).

---

## 📂 Estrutura do Projeto

*   `manifest.json`: Definição de permissões, configurações de segurança e declaração dos scripts da extensão.
*   `popup.html` / `popup.js`: O painel principal acessado pelo ícone da barra de ferramentas, usado para criar, filtrar, editar e exportar snippets.
*   `content.js`: O script injetado dinamicamente nas páginas para mapear campos de entrada, exibir o botão flutuante e processar os badges do assistente de ponto.
*   `inject_styles.css`: Estilização isolada dos componentes injetados na página (menu flutuante de snippets, botão "S", barra de rolagem customizada e badges de ponto).
*   `background.js`: Service Worker responsável por rodar tarefas assíncronas em segundo plano, como a expiração em tempo real de snippets temporários.

---

## ⚙️ Como Ativar no Navegador

Depois de baixar e extrair o `.zip` (ou clonar o repositório), siga estes passos rápidos:

1.  Abra o navegador baseado em Chromium e vá para a tela de extensões:
    *   **Chrome:** `chrome://extensions`
    *   **Opera:** `opera://extensions`
    *   **Edge:** `edge://extensions`
2.  Ative a opção **Modo do desenvolvedor** (Developer mode) no canto superior direito.
3.  Clique no botão **Carregar sem compactação** (Load unpacked) no canto superior esquerdo.
4.  Selecione a pasta onde os arquivos da extensão estão (a pasta extraída do zip ou a pasta clonada contendo o `manifest.json`).
5.  Pronto! Fixe o ícone do **Snippet Injector Pro** na sua barra de ferramentas para começar a usar.

---
Desenvolvido para máxima produtividade diária. 💡
