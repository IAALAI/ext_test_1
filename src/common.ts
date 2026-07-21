import browser from "webextension-polyfill";

export function countBookmarks(nodes: browser.Bookmarks.BookmarkTreeNode[]): number {
    let total = 0;
    for (const node of nodes) {
        if (node.url) total += 1;
        if (node.children?.length) total += countBookmarks(node.children);
    }
    return total;
}