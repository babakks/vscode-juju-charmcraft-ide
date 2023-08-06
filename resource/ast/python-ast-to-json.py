import sys
import ast
import json


def main():
    if len(sys.argv) != 2:
        exit(1)

    path = sys.argv[1]
    with open(path, "rt") as f:
        content = f.read()
    tree = ast.parse(content, path, "exec", type_comments=True)
    print(json.dumps(as_dict(tree)))


def as_dict(node):
    def _format(node):
        if isinstance(node, ast.AST):
            result = {
                "$type": node.__class__.__name__,
            }
            cls = type(node)
            for name in node._fields:
                try:
                    value = getattr(node, name)
                except AttributeError:
                    continue
                if value is None and getattr(cls, name, ...) is None:
                    continue
                result[name] = _format(value)
            for name in node._attributes:
                try:
                    value = getattr(node, name)
                except AttributeError:
                    continue
                if value is None and getattr(cls, name, ...) is None:
                    continue
                result[name] = _format(value)
            return result
        elif isinstance(node, list):
            if not node:
                return []
            return [_format(x) for x in node]
        return repr(node)

    if not isinstance(node, ast.AST):
        exit(1)
    return _format(node)


if __name__ == "__main__":
    main()
