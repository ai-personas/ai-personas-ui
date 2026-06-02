def merge_sort(values):
    """Return a sorted list containing the items from values."""
    items = list(values)
    if len(items) <= 1:
        return items

    middle = len(items) // 2
    left = merge_sort(items[:middle])
    right = merge_sort(items[middle:])

    merged = []
    i = 0
    j = 0

    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1

    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged
