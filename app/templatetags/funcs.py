from django import template

register = template.Library()

@register.filter
def mul(value, arg):
    return float(value) * float(arg)

@register.filter
def for_range(number):
    return range(number)

@register.filter
def modulo(value, arg):
    return value % arg

@register.filter
def divisibleby(value, arg):
    return value//arg