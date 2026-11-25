import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "node_modules/.comment-parsers"))
try:
    from tree_sitter_language_pack import get_parser
except ImportError:
    raise SystemExit("Comment parsers are missing. Run the comments:setup package script first.")

parsers = {}
COMMENT_TYPES = {"comment", "line_comment", "block_comment", "doc_comment", "documentation_comment"}


def walk(root):
    stack = [root]
    while stack:
        node = stack.pop()
        yield node
        if node.type not in COMMENT_TYPES:
            stack.extend(reversed(node.children))


def collect(source, language, offset=0):
    if language not in parsers:
        parsers[language] = get_parser(language)
    data = source.encode("utf-8")
    tree = parsers[language].parse(data)
    found = []
    for node in walk(tree.root_node):
        if node.type in COMMENT_TYPES:
            found.append({
                "value": data[node.start_byte:node.end_byte].decode("utf-8"),
                "line": offset + node.start_point.row + 1,
                "language": language,
            })
        elif language == "html" and node.type in ("script_element", "style_element"):
            nested = "javascript" if node.type == "script_element" else "css"
            media_type = None
            for attribute in node.children:
                if attribute.type != "start_tag":
                    continue
                for item in attribute.children:
                    if item.type != "attribute" or not item.named_children:
                        continue
                    key = data[item.named_children[0].start_byte:item.named_children[0].end_byte].decode("utf-8").lower()
                    if key == "type" and len(item.named_children) > 1:
                        value = item.named_children[1]
                        media_type = data[value.start_byte:value.end_byte].decode("utf-8").strip("\"'").lower().split(";", 1)[0].strip()
            javascript_types = {None, "", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript", "text/jscript", "text/livescript", "text/x-javascript", "text/x-ecmascript", "application/x-ecmascript", "text/javascript1.0", "text/javascript1.1", "text/javascript1.2", "text/javascript1.3", "text/javascript1.4", "text/javascript1.5", "application/x-javascript", "text/jsx", "text/babel"}
            if (nested == "javascript" and media_type not in javascript_types) or (nested == "css" and media_type not in {None, "", "text/css"}):
                continue
            for child in node.children:
                if child.type == "raw_text":
                    found.extend(collect(data[child.start_byte:child.end_byte].decode("utf-8"), nested, offset + child.start_point.row))
    return found


try:
    payloads = json.load(sys.stdin)
    result = []
    for payload in payloads:
        for comment in collect(payload["source"], payload["language"], payload.get("offset", 0)):
            result.append({"file": payload["file"], **comment})
    json.dump(result, sys.stdout)
except Exception as error:
    raise SystemExit(f"Comment parsing failed: {error}") from error
