type MarkdownNode = { type: string; depth?: number; children?: MarkdownNode[] };

/** Repository presentation HTML before the page title belongs to GitHub, not the native docs article. */
export function docsPreamble() {
  return (tree: MarkdownNode) => {
    const children = tree.children ?? [];
    const title = children.findIndex(node => node.type !== 'html');
    if (title > 0 && children[title].type === 'heading' && children[title].depth === 1) {
      children.splice(0, title);
    }
  };
}
