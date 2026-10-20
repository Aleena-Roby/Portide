from django.db import migrations


def seed_data(apps, schema_editor):
    Truck = apps.get_model('authentication', 'Truck')
    Driver = apps.get_model('authentication', 'Driver')
    Gate = apps.get_model('authentication', 'Gate')

    # Seed Trucks
    trucks = [
        {'truck_number': 'KL-05-AB-7824', 'truck_company_name': 'Kerala Express Freight Logistics', 'truck_status': 'ACTIVE'},
        {'truck_number': 'MH-04-AZ-9921', 'truck_company_name': 'National Container Haulage Ltd', 'truck_status': 'ACTIVE'},
        {'truck_number': 'DL-01-AX-4433', 'truck_company_name': 'Interstate Cargo Carriers', 'truck_status': 'ACTIVE'},
        {'truck_number': 'KA-01-MJ-5566', 'truck_company_name': 'Southern Port Transport Co', 'truck_status': 'ACTIVE'},
        {'truck_number': 'TN-09-CD-1122', 'truck_company_name': 'Coromandel Coastal Express', 'truck_status': 'ACTIVE'},
    ]
    for t in trucks:
        Truck.objects.get_or_create(truck_number=t['truck_number'], defaults=t)

    # Seed Drivers
    drivers = [
        {
            'driver_name': 'Arun Thomas',
            'driver_license_number': 'DL-KL-2018-0091823',
            'driver_phone': '+91 98471 23456',
            'driver_email': 'arun.thomas.portide@gmail.com',
            'driver_status': 'ACTIVE'
        },
        {
            'driver_name': 'Sunil Sharma',
            'driver_license_number': 'DL-MH-2019-881234',
            'driver_phone': '+91 98200 12345',
            'driver_email': 'sunil.sharma.transport@gmail.com',
            'driver_status': 'ACTIVE'
        },
        {
            'driver_name': 'Praveen Kumar',
            'driver_license_number': 'DL-KA-2020-0043121',
            'driver_phone': '+91 97412 88990',
            'driver_email': 'praveen.kumar.haulage@gmail.com',
            'driver_status': 'ACTIVE'
        },
        {
            'driver_name': 'Sanjay Verma',
            'driver_license_number': 'DL-DL-2017-0056789',
            'driver_phone': '+91 98111 65432',
            'driver_email': 'sanjay.verma.freight@gmail.com',
            'driver_status': 'ACTIVE'
        }
    ]
    for d in drivers:
        Driver.objects.get_or_create(driver_license_number=d['driver_license_number'], defaults=d)

    # Seed Gates
    gates = [
        {'gate_name': 'Main Freight Gate 1 (North Terminal)', 'gate_code': 'GATE-NORTH-1', 'gate_type': 'OUTBOUND', 'gate_is_active': True},
        {'gate_name': 'Commercial Exit Gate 2 (East Terminal)', 'gate_code': 'GATE-EAST-2', 'gate_type': 'OUTBOUND', 'gate_is_active': True},
        {'gate_name': 'Heavy Haul Gate 3 (South Terminal)', 'gate_code': 'GATE-SOUTH-3', 'gate_type': 'OUTBOUND', 'gate_is_active': True},
        {'gate_name': 'Express Container Gate 4 (West Gate)', 'gate_code': 'GATE-WEST-4', 'gate_type': 'OUTBOUND', 'gate_is_active': True},
        {'gate_name': 'Central Logistics Exit Gate', 'gate_code': 'GATE-CENTRAL-5', 'gate_type': 'OUTBOUND', 'gate_is_active': True},
    ]
    for g in gates:
        Gate.objects.get_or_create(gate_code=g['gate_code'], defaults=g)


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0027_driver_gate_truck_gatepass_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_data, reverse_seed),
    ]
