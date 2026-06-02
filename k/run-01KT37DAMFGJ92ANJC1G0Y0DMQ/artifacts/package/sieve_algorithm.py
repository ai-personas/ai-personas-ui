def first_primes(count):
    """Return the first count prime numbers using a Sieve of Eratosthenes."""
    if count < 0:
        raise ValueError("count must be non-negative")
    if count == 0:
        return []

    limit = 16
    while True:
        sieve = [True] * (limit + 1)
        if limit >= 0:
            sieve[0] = False
        if limit >= 1:
            sieve[1] = False

        root = int(limit ** 0.5)
        for candidate in range(2, root + 1):
            if sieve[candidate]:
                start = candidate * candidate
                for multiple in range(start, limit + 1, candidate):
                    sieve[multiple] = False

        primes = [n for n in range(2, limit + 1) if sieve[n]]
        if len(primes) >= count:
            return primes[:count]
        limit *= 2
