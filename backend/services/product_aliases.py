"""
Product name aliases — maps Arabic/Darija/French/English names to a canonical form.
Used to match "tomates" with "طماطم", "بطاطس" with "pommes de terre", etc.
"""

# Canonical product name → list of aliases (all lowercase)
PRODUCT_ALIASES = {
    "tomates": ["طماطم", "طماطش", "tomatich", "tomate", "tomato", "tomatoes", "matisha", "ماطيشا"],
    "oignons": ["بصل", "بصلة", "oignon", "onion", "onions", "lbsal", "لبصل", "بصلا"],
    "pommes de terre": ["بطاطس", "بطاطا", "patates", "potato", "potatoes", "btata", "بطاطا"],
    "carottes": ["جزر", "خيزو", "carotte", "carrot", "carrots", "khizou", "خيزو"],
    "sucre": ["سكر", "سكار", "sugar", "soukar", "sucr", "سكر"],
    "farine": ["فارينة", "دقيق", "flour", "farina", "dkik", "الدقيق"],
    "huile": ["زيت", "oil", "lhuile", "الزيت", "زيت المائدة", "huile de table"],
    "riz": ["روز", "أرز", "rice", "roz", "الروز", "الأرز"],
    "lait": ["حليب", "lben", "milk", "لبن", "حليب", "الحليب"],
    "beurre": ["زبدة", "butter", "zebda", "الزبدة"],
    "sel": ["ملح", "salt", "lmelh", "الملح"],
    "poivre": ["ابزار", "فلفل", "pepper", "ibzar", "الإبزار", "فلفل أسود"],
    "cafe": ["قهوة", "coffee", "kahwa", "café", "القهوة", "نسكافي", "nescafe"],
    "the": ["أتاي", "شاي", "tea", "atay", "thé", "الأتاي", "الشاي"],
    "pain": ["خبز", "bread", "khobz", "الخبز"],
    "lentilles": ["عدس", "lentils", "3ds", "العدس"],
    "pois chiches": ["حمص", "chickpeas", "hommos", "الحمص"],
    "haricots": ["لوبيا", "فاصوليا", "beans", "loubia", "اللوبيا"],
    "couscous": ["كسكس", "سكسو", "sekso", "الكسكس"],
    "poulet": ["دجاج", "chicken", "djaj", "الدجاج"],
    "viande": ["لحم", "meat", "lhm", "اللحم", "لحمة"],
    "poisson": ["حوت", "سمك", "fish", "hout", "الحوت"],
    "oeufs": ["بيض", "eggs", "oeuf", "لبيض", "البيض"],
    "tomate concentre": ["معجون", "مصبرة", "concentre tomate", "tomato paste", "ma3joun", "صلصة"],
    "olives": ["زيتون", "olive", "zitoune", "الزيتون"],
    "citron": ["حامض", "ليمون", "lemon", "hamed", "الحامض"],
    "banane": ["بنان", "موز", "banana", "banane", "الموز", "بنانة"],
    "pomme": ["تفاح", "apple", "teffah", "التفاح"],
    "orange": ["ليمون", "برتقال", "limoun", "البرتقال"],
    "eau": ["ماء", "water", "lma", "الماء", "سيدي علي", "أولماس"],
    "savon": ["صابون", "soap", "saboun", "الصابون"],
    "detergent": ["تيد", "tide", "مسحوق", "omo", "أومو", "جافيل", "javel"],
    "mouchoirs": ["كلينكس", "kleenex", "tissue", "منديل"],
    "chips": ["شيبس", "بطاطس مقلية", "crisps", "lay's", "ليز"],
    "biscuits": ["بسكوي", "cookies", "biskwi", "بسكويت"],
    "jus": ["عصير", "juice", "3sir", "العصير"],
    "soda": ["كوكا", "coca", "pepsi", "بيبسي", "مشروب غازي", "كوكاكولا"],
    "yaourt": ["ياغورت", "دانون", "yogurt", "danone", "الياغورت"],
    "fromage": ["جبن", "فروماج", "cheese", "froumaj", "الجبن"],
    "sardines": ["سردين", "sardine", "صرديل", "السردين"],
    "thon": ["تون", "طون", "tuna", "التون"],
    "pates": ["معكرونة", "مكرونة", "pasta", "spaghetti", "ma3karona", "المعكرونة"],
    "confiture": ["مربى", "jam", "المربى", "كونفيتير"],
    "miel": ["عسل", "honey", "العسل"],
    "chocolat": ["شوكولاطة", "chocolate", "شكلاط"],
    "bonbons": ["حلوى", "candy", "sweets", "الحلوى"],
    "papier toilette": ["بابي", "toilet paper", "محارم", "papia"],
}

# Build reverse lookup: alias → canonical name
_ALIAS_MAP = {}
for canonical, aliases in PRODUCT_ALIASES.items():
    _ALIAS_MAP[canonical.lower()] = canonical
    for alias in aliases:
        _ALIAS_MAP[alias.lower().strip()] = canonical


def find_canonical_name(name: str) -> str | None:
    """Find the canonical French name for a product given any alias."""
    return _ALIAS_MAP.get(name.lower().strip())


def are_same_product(name1: str, name2: str) -> bool:
    """Check if two product names refer to the same product."""
    c1 = find_canonical_name(name1)
    c2 = find_canonical_name(name2)
    if c1 and c2 and c1 == c2:
        return True
    # Fallback: direct match
    return name1.lower().strip() == name2.lower().strip()


def get_all_aliases(name: str) -> list[str]:
    """Get all known aliases for a product name."""
    canonical = find_canonical_name(name)
    if not canonical:
        return [name]
    aliases = [canonical] + PRODUCT_ALIASES.get(canonical, [])
    return aliases
