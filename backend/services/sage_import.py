"""
Sage 100 v7 CSV Import Service
Parses Sage 100 export files (articles, ventes, clients) and imports them into Souk.AI
"""
import csv
import io
import re
from typing import Optional


def normalize_header(header: str) -> str:
    """Normalize header: lowercase, strip, remove accents-like chars."""
    h = header.strip().lower().replace("\ufeff", "")
    h = re.sub(r'[éèê]', 'e', h)
    h = re.sub(r'[àâ]', 'a', h)
    h = re.sub(r'[ùû]', 'u', h)
    h = re.sub(r'[ôö]', 'o', h)
    h = re.sub(r'[îï]', 'i', h)
    h = re.sub(r'[ç]', 'c', h)
    return h.strip()


def detect_delimiter(content: str) -> str:
    """Detect CSV delimiter (Sage uses ; by default, but can also be , or tab)."""
    first_line = content.split('\n')[0]
    counts = {';': first_line.count(';'), ',': first_line.count(','), '\t': first_line.count('\t')}
    return max(counts, key=counts.get) if max(counts.values()) > 0 else ';'


def parse_sage_articles(content: str) -> list[dict]:
    """
    Parse Sage 100 article export CSV.
    Common Sage 100 columns: Reference, Designation, Famille, PrixVente, PrixAchat, Unite, CodeBarre, Stock
    Also supports: ref, reference, code, designation, intitule, libelle, prix_vente, prix_achat, pv, pa, etc.
    """
    delimiter = detect_delimiter(content)
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)

    # Map Sage column names to our fields
    column_map = {
        'reference': 'reference', 'ref': 'reference', 'code': 'reference', 'code_article': 'reference',
        'codearticle': 'reference', 'no_article': 'reference',
        'designation': 'name', 'intitule': 'name', 'libelle': 'name', 'nom': 'name',
        'article': 'name', 'description': 'name', 'nom_article': 'name',
        'famille': 'category', 'categorie': 'category', 'type': 'category', 'groupe': 'category',
        'prixvente': 'unit_price', 'prix_vente': 'unit_price', 'pv': 'unit_price',
        'prixventettc': 'unit_price', 'prix_vente_ttc': 'unit_price',
        'pvttc': 'unit_price', 'prix': 'unit_price', 'price': 'unit_price',
        'prixachat': 'cost_price', 'prix_achat': 'cost_price', 'pa': 'cost_price',
        'prixachatht': 'cost_price', 'cout': 'cost_price', 'cost': 'cost_price',
        'unite': 'unit', 'unit': 'unit', 'uv': 'unit', 'unite_vente': 'unit',
        'codebarre': 'barcode', 'code_barre': 'barcode', 'ean': 'barcode',
        'ean13': 'barcode', 'barcode': 'barcode', 'gtin': 'barcode',
        'stock': 'stock', 'quantite': 'stock', 'qte': 'stock', 'qty': 'stock',
        'stock_actuel': 'stock', 'stockactuel': 'stock', 'en_stock': 'stock',
    }

    products = []
    if not reader.fieldnames:
        return products

    # Build field mapping
    field_map = {}
    for col in reader.fieldnames:
        normalized = normalize_header(col)
        if normalized in column_map:
            field_map[col] = column_map[normalized]

    for row in reader:
        product = {}
        for csv_col, our_field in field_map.items():
            val = row.get(csv_col, '').strip()
            if val:
                product[our_field] = val

        # Must have at least a name
        if not product.get('name'):
            if product.get('reference'):
                product['name'] = product['reference']
            else:
                continue

        # Parse numeric fields
        for field in ('unit_price', 'cost_price', 'stock'):
            if field in product:
                try:
                    product[field] = float(product[field].replace(',', '.').replace(' ', ''))
                except (ValueError, AttributeError):
                    product[field] = 0.0

        # Map Sage units to our units
        unit_raw = product.get('unit', '').lower()
        if unit_raw in ('kg', 'kilo', 'kilogramme'):
            product['unit'] = 'kg'
        elif unit_raw in ('l', 'litre', 'lt'):
            product['unit'] = 'litre'
        elif unit_raw in ('crt', 'carton', 'ct'):
            product['unit'] = 'carton'
        else:
            product['unit'] = 'piece'

        products.append(product)

    return products


def parse_sage_sales(content: str) -> list[dict]:
    """
    Parse Sage 100 sales/invoices export CSV.
    Common columns: Date, NumPiece, Reference, Designation, Quantite, PrixUnitaire, MontantHT, MontantTTC
    """
    delimiter = detect_delimiter(content)
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)

    column_map = {
        'date': 'date', 'datepiece': 'date', 'date_piece': 'date', 'date_facture': 'date',
        'numpiece': 'invoice_number', 'num_piece': 'invoice_number', 'numero': 'invoice_number',
        'no_facture': 'invoice_number', 'facture': 'invoice_number',
        'reference': 'product_ref', 'ref': 'product_ref', 'code_article': 'product_ref',
        'designation': 'product_name', 'article': 'product_name', 'libelle': 'product_name',
        'nom': 'product_name',
        'quantite': 'quantity', 'qte': 'quantity', 'qty': 'quantity',
        'prixunitaire': 'unit_price', 'prix_unitaire': 'unit_price', 'pu': 'unit_price',
        'montantht': 'total_ht', 'montant_ht': 'total_ht', 'total_ht': 'total_ht',
        'montantttc': 'total_ttc', 'montant_ttc': 'total_ttc', 'total_ttc': 'total_ttc',
        'total': 'total_ttc', 'montant': 'total_ttc',
        'client': 'client_name', 'nom_client': 'client_name', 'tiers': 'client_name',
    }

    sales = []
    if not reader.fieldnames:
        return sales

    field_map = {}
    for col in reader.fieldnames:
        normalized = normalize_header(col)
        if normalized in column_map:
            field_map[col] = column_map[normalized]

    for row in reader:
        sale = {}
        for csv_col, our_field in field_map.items():
            val = row.get(csv_col, '').strip()
            if val:
                sale[our_field] = val

        if not sale.get('product_name') and not sale.get('product_ref'):
            continue

        for field in ('quantity', 'unit_price', 'total_ht', 'total_ttc'):
            if field in sale:
                try:
                    sale[field] = float(sale[field].replace(',', '.').replace(' ', ''))
                except (ValueError, AttributeError):
                    sale[field] = 0.0

        sales.append(sale)

    return sales


def parse_sage_clients(content: str) -> list[dict]:
    """
    Parse Sage 100 client export CSV.
    Common columns: NumClient, RaisonSociale, Adresse, Ville, Telephone, Email
    """
    delimiter = detect_delimiter(content)
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)

    column_map = {
        'numclient': 'client_id', 'num_client': 'client_id', 'code': 'client_id',
        'code_client': 'client_id', 'numero': 'client_id',
        'raisonsociale': 'name', 'raison_sociale': 'name', 'nom': 'name',
        'intitule': 'name', 'client': 'name', 'designation': 'name',
        'adresse': 'address', 'adresse1': 'address', 'rue': 'address',
        'ville': 'city', 'commune': 'city',
        'codepostal': 'postal_code', 'code_postal': 'postal_code', 'cp': 'postal_code',
        'telephone': 'phone', 'tel': 'phone', 'tel1': 'phone', 'mobile': 'phone',
        'email': 'email', 'mail': 'email', 'e_mail': 'email',
    }

    clients = []
    if not reader.fieldnames:
        return clients

    field_map = {}
    for col in reader.fieldnames:
        normalized = normalize_header(col)
        if normalized in column_map:
            field_map[col] = column_map[normalized]

    for row in reader:
        client = {}
        for csv_col, our_field in field_map.items():
            val = row.get(csv_col, '').strip()
            if val:
                client[our_field] = val

        if not client.get('name'):
            continue

        clients.append(client)

    return clients


def detect_sage_file_type(content: str) -> Optional[str]:
    """Auto-detect the type of Sage export file based on headers."""
    delimiter = detect_delimiter(content)
    first_line = content.split('\n')[0].lower()
    first_line = normalize_header(first_line)

    if any(kw in first_line for kw in ['prixvente', 'prix_vente', 'prixachat', 'prix_achat',
                                         'stock', 'codebarre', 'code_barre', 'unite']):
        return 'articles'
    elif any(kw in first_line for kw in ['montant', 'facture', 'numpiece', 'num_piece',
                                          'montantttc', 'montant_ttc']):
        return 'sales'
    elif any(kw in first_line for kw in ['raisonsociale', 'raison_sociale', 'ville',
                                          'codepostal', 'code_postal']):
        return 'clients'
    elif any(kw in first_line for kw in ['designation', 'reference', 'prix', 'quantite']):
        # Could be articles or sales, check for more clues
        if 'stock' in first_line or 'unite' in first_line:
            return 'articles'
        return 'articles'  # Default to articles

    return None
