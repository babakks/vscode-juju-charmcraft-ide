## Adding/updating test cases

If you updated/added a Python file, make sure to update/create the corresponding AST json file via running this command (from the repo's root directory):

```sh
python3 resource/ast/python-ast-to-json.py resource/test/ast/FILENAME.py > resource/test/ast/FILENAME.json
```

Make sure `.py` and `.json` files both having the same filename (except for their extension, for example, `charm-01.py` and `charm-01.json`) because the filename is used in the tests to group test case files.