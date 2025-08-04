from django import template

register = template.Library()

@register.filter
def for_range(number):
    return range(number)