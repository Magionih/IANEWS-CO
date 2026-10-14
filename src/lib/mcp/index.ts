import { defineMcp } from "@lovable.dev/mcp-js";
import listArticlesTool from "./tools/list-articles";
import searchArticlesTool from "./tools/search-articles";
import getArticleTool from "./tools/get-article";

export default defineMcp({
  name: "revitalize-our-site",
  title: "Revitalize Our Site",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura do IA News (ianews.site), portal brasileiro de notícias sobre inteligência artificial. Use `list_articles` para as matérias mais recentes, `search_articles` para buscar por tema e `get_article` para ler o conteúdo completo de uma matéria pelo slug.",
  tools: [listArticlesTool, searchArticlesTool, getArticleTool],
});