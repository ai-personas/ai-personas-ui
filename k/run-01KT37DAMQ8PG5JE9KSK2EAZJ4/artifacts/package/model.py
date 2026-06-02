import math

def damped_oscillator_sample(t, omega_0=2.0, beta=0.15, x0=1.0, v0=0.0, mass=1.0):
    if not (0.0 <= beta < omega_0):
        raise ValueError("requires underdamped oscillator: 0 <= beta < omega_0")
    omega_d = math.sqrt(omega_0 * omega_0 - beta * beta)
    c1 = x0
    c2 = (v0 + beta * x0) / omega_d
    envelope = math.exp(-beta * t)
    cos_t = math.cos(omega_d * t)
    sin_t = math.sin(omega_d * t)
    x = envelope * (c1 * cos_t + c2 * sin_t)
    v = envelope * (
        -beta * (c1 * cos_t + c2 * sin_t)
        + (-c1 * omega_d * sin_t + c2 * omega_d * cos_t)
    )
    energy = 0.5 * mass * v * v + 0.5 * mass * omega_0 * omega_0 * x * x
    return x, v, energy
