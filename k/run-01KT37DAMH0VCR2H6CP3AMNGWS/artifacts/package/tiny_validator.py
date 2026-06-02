TYPE_CHECKS = {
    "string": lambda value: isinstance(value, str),
    "integer": lambda value: isinstance(value, int) and not isinstance(value, bool),
    "number": lambda value: (isinstance(value, int) or isinstance(value, float)) and not isinstance(value, bool),
    "boolean": lambda value: isinstance(value, bool),
    "object": lambda value: isinstance(value, dict),
    "array": lambda value: isinstance(value, list),
    "null": lambda value: value is None,
}

def validate(instance, schema):
    errors = []
    if not isinstance(schema, dict):
        return False, ["schema must be an object"]
    if not isinstance(instance, dict):
        return False, ["instance must be an object"]

    required = schema.get("required", [])
    properties = schema.get("properties", {})

    if not isinstance(required, list) or not all(isinstance(key, str) for key in required):
        return False, ["schema.required must be a list of strings"]
    if not isinstance(properties, dict):
        return False, ["schema.properties must be an object"]

    for key in required:
        if key not in instance:
            errors.append("missing required key: " + key)

    for key, spec in properties.items():
        if key not in instance:
            continue
        if not isinstance(spec, dict):
            errors.append("property spec must be an object: " + key)
            continue
        expected = spec.get("type")
        checker = TYPE_CHECKS.get(expected)
        if checker is None:
            errors.append("unsupported type for " + key + ": " + repr(expected))
            continue
        if not checker(instance[key]):
            errors.append("wrong type for " + key + ": expected " + expected)

    return len(errors) == 0, errors
