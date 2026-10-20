from django.db import migrations


def seed_yard_master(apps, schema_editor):
    Yard = apps.get_model('authentication', 'Yard')
    YardBlock = apps.get_model('authentication', 'YardBlock')
    YardSlot = apps.get_model('authentication', 'YardSlot')

    # 1. Yards
    yards_data = [
        {
            'yard_name': 'Main Terminal Container Yard Alpha',
            'yard_code': 'CY-ALPHA',
            'yard_type': 'CONTAINER_YARD',
            'yard_status': 'ACTIVE',
            'yard_capacity': 300,
            'yard_occupied': 45
        },
        {
            'yard_name': 'Empty Container Logistics Yard Bravo',
            'yard_code': 'EY-BRAVO',
            'yard_type': 'EMPTY_CONTAINER_YARD',
            'yard_status': 'ACTIVE',
            'yard_capacity': 200,
            'yard_occupied': 30
        },
        {
            'yard_name': 'Cold Chain Reefer Storage Yard Charlie',
            'yard_code': 'RY-CHARLIE',
            'yard_type': 'REEFER_YARD',
            'yard_status': 'ACTIVE',
            'yard_capacity': 150,
            'yard_occupied': 20
        },
        {
            'yard_name': 'General Storage Yard Delta',
            'yard_code': 'GY-DELTA',
            'yard_type': 'GENERAL_STORAGE',
            'yard_status': 'ACTIVE',
            'yard_capacity': 100,
            'yard_occupied': 0
        }
    ]

    created_yards = {}
    for yd in yards_data:
        obj, _ = Yard.objects.get_or_create(yard_code=yd['yard_code'], defaults=yd)
        created_yards[yd['yard_code']] = obj

    # 2. Blocks
    blocks_data = [
        # CY-ALPHA blocks
        {
            'yard_block_yard_id': created_yards['CY-ALPHA'],
            'yard_block_name': 'North Stacking Block A01',
            'yard_block_code': 'A01',
            'yard_block_type': 'STANDARD',
            'yard_block_status': 'ACTIVE',
            'yard_block_capacity': 100,
            'yard_block_occupied': 25
        },
        {
            'yard_block_yard_id': created_yards['CY-ALPHA'],
            'yard_block_name': 'Central Stacking Block A02',
            'yard_block_code': 'A02',
            'yard_block_type': 'STANDARD',
            'yard_block_status': 'ACTIVE',
            'yard_block_capacity': 100,
            'yard_block_occupied': 20
        },
        {
            'yard_block_yard_id': created_yards['CY-ALPHA'],
            'yard_block_name': 'Hazardous Cargo Block A03',
            'yard_block_code': 'A03',
            'yard_block_type': 'HAZMAT',
            'yard_block_status': 'ACTIVE',
            'yard_block_capacity': 100,
            'yard_block_occupied': 0
        },
        # EY-BRAVO blocks
        {
            'yard_block_yard_id': created_yards['EY-BRAVO'],
            'yard_block_name': 'Empty Staging Block B01',
            'yard_block_code': 'B01',
            'yard_block_type': 'EMPTY',
            'yard_block_status': 'ACTIVE',
            'yard_block_capacity': 100,
            'yard_block_occupied': 15
        },
        {
            'yard_block_yard_id': created_yards['EY-BRAVO'],
            'yard_block_name': 'Empty Repair Block B02',
            'yard_block_code': 'B02',
            'yard_block_type': 'EMPTY',
            'yard_block_status': 'ACTIVE',
            'yard_block_capacity': 100,
            'yard_block_occupied': 15
        },
        # RY-CHARLIE blocks
        {
            'yard_block_yard_id': created_yards['RY-CHARLIE'],
            'yard_block_name': 'Powered Reefer Bank C01',
            'yard_block_code': 'C01',
            'yard_block_type': 'REEFER',
            'yard_block_status': 'ACTIVE',
            'yard_block_capacity': 75,
            'yard_block_occupied': 10
        },
        {
            'yard_block_yard_id': created_yards['RY-CHARLIE'],
            'yard_block_name': 'Powered Reefer Bank C02',
            'yard_block_code': 'C02',
            'yard_block_type': 'REEFER',
            'yard_block_status': 'ACTIVE',
            'yard_block_capacity': 75,
            'yard_block_occupied': 10
        }
    ]

    created_blocks = {}
    for bd in blocks_data:
        obj, _ = YardBlock.objects.get_or_create(
            yard_block_yard_id=bd['yard_block_yard_id'],
            yard_block_code=bd['yard_block_code'],
            defaults=bd
        )
        created_blocks[f"{bd['yard_block_yard_id'].yard_code}_{bd['yard_block_code']}"] = obj

    # 3. Slots in Block A01
    block_a01 = created_blocks.get('CY-ALPHA_A01')
    if block_a01:
        slots_data = [
            {'yard_slot_row': 1, 'yard_slot_bay': 1, 'yard_slot_tier': 1, 'yard_slot_code': 'A01-R01-B01-T01', 'yard_slot_status': 'AVAILABLE'},
            {'yard_slot_row': 1, 'yard_slot_bay': 2, 'yard_slot_tier': 1, 'yard_slot_code': 'A01-R01-B02-T01', 'yard_slot_status': 'AVAILABLE'},
            {'yard_slot_row': 2, 'yard_slot_bay': 1, 'yard_slot_tier': 1, 'yard_slot_code': 'A01-R02-B01-T01', 'yard_slot_status': 'OCCUPIED'},
            {'yard_slot_row': 2, 'yard_slot_bay': 2, 'yard_slot_tier': 1, 'yard_slot_code': 'A01-R02-B02-T01', 'yard_slot_status': 'AVAILABLE'},
            {'yard_slot_row': 3, 'yard_slot_bay': 1, 'yard_slot_tier': 1, 'yard_slot_code': 'A01-R03-B01-T01', 'yard_slot_status': 'RESERVED'},
            {'yard_slot_row': 3, 'yard_slot_bay': 2, 'yard_slot_tier': 1, 'yard_slot_code': 'A01-R03-B02-T01', 'yard_slot_status': 'BLOCKED'},
        ]
        for sd in slots_data:
            YardSlot.objects.get_or_create(
                yard_slot_block_id=block_a01,
                yard_slot_code=sd['yard_slot_code'],
                defaults={
                    'yard_slot_block_id': block_a01,
                    **sd
                }
            )


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0030_yard_yardblock_yardslot'),
    ]

    operations = [
        migrations.RunPython(seed_yard_master, reverse_seed),
    ]
