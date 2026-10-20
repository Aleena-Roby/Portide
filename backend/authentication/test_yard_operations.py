import json
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from authentication.models import (
    Login,
    User,
    ShippingCompany,
    Vessel,
    VesselArrivalRequest,
    Cargo,
    Port,
    Container,
    Yard,
    YardBlock,
    YardSlot,
    YardAllocation,
    YardMovementHistory,
    AuditLog,
    Crane,
    CraneAllocation,
    VesselSchedule,
    Berth
)


class YardOperationsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Terminal & Logistics Operator User (Authorized Operator)
        self.login_tlo = Login.objects.create(
            login_email="terminal@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_logistics_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_tlo = User.objects.create(
            login_id=self.login_tlo,
            user_full_name="Tariq Terminal",
            user_phone="+919876543201",
            user_status="ACTIVE"
        )
        self.headers_tlo = {
            'HTTP_X_USER_EMAIL': 'terminal@portide.com',
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.user_tlo.user_id)
        }

        # 2. Port Administrator User (Authorized Management)
        self.login_admin = Login.objects.create(
            login_email="admin@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_admin = User.objects.create(
            login_id=self.login_admin,
            user_full_name="Port Administrator",
            user_phone="+919876543202",
            user_status="ACTIVE"
        )
        self.headers_admin = {
            'HTTP_X_USER_EMAIL': 'admin@portide.com',
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.user_admin.user_id)
        }

        # 3. Port Operations Officer User (Read-Only)
        self.login_ops = Login.objects.create(
            login_email="ops@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_ops = User.objects.create(
            login_id=self.login_ops,
            user_full_name="Operations Officer",
            user_phone="+919876543203",
            user_status="ACTIVE"
        )
        self.headers_ops = {
            'HTTP_X_USER_EMAIL': 'ops@portide.com',
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.user_ops.user_id)
        }

        # 4. Shipping Company User (Denied)
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Global Ocean Lines",
            shipping_company_license_number="LIC-GOL-01",
            shipping_company_email="agent@globalocean.com",
            shipping_company_phone="+919876543204",
            shipping_company_address="Port Pier 5",
            shipping_company_jurisdiction="West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_shipping = Login.objects.create(
            login_email="agent@globalocean.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_shipping = User.objects.create(
            login_id=self.login_shipping,
            shipping_company_id=self.company,
            user_full_name="Shipping Agent",
            user_phone="+919876543204",
            user_status="ACTIVE"
        )
        self.headers_shipping = {
            'HTTP_X_USER_EMAIL': 'agent@globalocean.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.user_shipping.user_id)
        }

        # 5. Customs Officer (Denied)
        self.login_customs = Login.objects.create(
            login_email="customs@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="customs_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_customs = User.objects.create(
            login_id=self.login_customs,
            user_full_name="Customs Officer",
            user_phone="+919876543205",
            user_status="ACTIVE"
        )
        self.headers_customs = {
            'HTTP_X_USER_EMAIL': 'customs@portide.com',
            'HTTP_X_USER_ROLE': 'customs_officer',
            'HTTP_X_USER_ID': str(self.user_customs.user_id)
        }

        # 6. Gate & Truck Operations Officer (Denied)
        self.login_gate = Login.objects.create(
            login_email="gate@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_gate = User.objects.create(
            login_id=self.login_gate,
            user_full_name="Gate Officer",
            user_phone="+919876543206",
            user_status="ACTIVE"
        )
        self.headers_gate = {
            'HTTP_X_USER_EMAIL': 'gate@portide.com',
            'HTTP_X_USER_ROLE': 'gate_truck_officer',
            'HTTP_X_USER_ID': str(self.user_gate.user_id)
        }

        # Setup Ports, Vessel, Arrival, Cargo, Container
        self.port_singapore, _ = Port.objects.get_or_create(
            port_code="SGSIN",
            defaults={"port_name": "Port of Singapore", "port_country": "Singapore", "port_country_code": "SG"}
        )
        self.port_mumbai, _ = Port.objects.get_or_create(
            port_code="INBOM",
            defaults={"port_name": "Mumbai Port", "port_country": "India", "port_country_code": "IN"}
        )

        self.vessel, _ = Vessel.objects.get_or_create(
            vessel_imo_number="9234567",
            defaults={
                "vessel_shipping_company_id": self.company,
                "vessel_name": "Indian Ocean Pioneer",
                "vessel_type": "Container Ship",
                "vessel_flag": "Panama",
                "vessel_length": Decimal("320.00"),
                "vessel_draft": Decimal("13.00"),
                "vessel_capacity": 12000
            }
        )

        now = timezone.now()
        self.arrival = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=150,
            vessel_arrival_request_status="APPROVED"
        )

        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival,
            cargo_description="Industrial Machinery",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("150.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("2000.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        self.container1 = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSKU8888888",
            container_type="20FT",
            container_gross_weight=Decimal("22.50"),
            container_status="AT_TERMINAL"
        )

        self.container2 = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MEDU7777777",
            container_type="40FT",
            container_gross_weight=Decimal("30.00"),
            container_status="AT_TERMINAL"
        )

        # Setup Yard Hierarchy:
        # Yard 1: CY-T3-A (Capacity: 100, Occupied: 0)
        self.yard_alpha = Yard.objects.create(
            yard_code="CY-T3-A",
            yard_name="Container Yard Alpha",
            yard_type="CONTAINER_YARD",
            yard_capacity=100,
            yard_occupied=0,
            yard_status="ACTIVE"
        )

        # Block 1 in Yard Alpha: T3-A01 (Capacity: 20, Occupied: 0)
        self.block_a01 = YardBlock.objects.create(
            yard_block_yard_id=self.yard_alpha,
            yard_block_code="T3-A01",
            yard_block_name="Block A01",
            yard_block_type="STANDARD",
            yard_block_capacity=20,
            yard_block_occupied=0,
            yard_block_status="ACTIVE"
        )

        # Block 2 in Yard Alpha: T3-A02 (Capacity: 20, Occupied: 0)
        self.block_a02 = YardBlock.objects.create(
            yard_block_yard_id=self.yard_alpha,
            yard_block_code="T3-A02",
            yard_block_name="Block A02",
            yard_block_type="STANDARD",
            yard_block_capacity=20,
            yard_block_occupied=0,
            yard_block_status="ACTIVE"
        )

        # Slots in Block T3-A01:
        self.slot_a01_1 = YardSlot.objects.create(
            yard_slot_block_id=self.block_a01,
            yard_slot_code="T3-A01-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="AVAILABLE"
        )
        self.slot_a01_2 = YardSlot.objects.create(
            yard_slot_block_id=self.block_a01,
            yard_slot_code="T3-A01-R01-B02-T01",
            yard_slot_row=1,
            yard_slot_bay=2,
            yard_slot_tier=1,
            yard_slot_status="AVAILABLE"
        )

        # Slot in Block T3-A02:
        self.slot_a02_1 = YardSlot.objects.create(
            yard_slot_block_id=self.block_a02,
            yard_slot_code="T3-A02-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="AVAILABLE"
        )

        # Yard 2: CY-T3-B (Cross-Yard Destination) (Capacity: 50, Occupied: 0)
        self.yard_beta = Yard.objects.create(
            yard_code="CY-T3-B",
            yard_name="Container Yard Beta",
            yard_type="CONTAINER_YARD",
            yard_capacity=50,
            yard_occupied=0,
            yard_status="ACTIVE"
        )

        self.block_b01 = YardBlock.objects.create(
            yard_block_yard_id=self.yard_beta,
            yard_block_code="T3-B01",
            yard_block_name="Block B01",
            yard_block_type="STANDARD",
            yard_block_capacity=15,
            yard_block_occupied=0,
            yard_block_status="ACTIVE"
        )

        self.slot_b01_1 = YardSlot.objects.create(
            yard_slot_block_id=self.block_b01,
            yard_slot_code="T3-B01-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="AVAILABLE"
        )

    # =========================================================================
    # Test 1: Container location without active allocation
    # =========================================================================
    def test_01_current_location_without_active_allocation(self):
        res = self.client.get(
            f'/api/terminal/yard-operations/containers/{self.container1.container_id}/location/',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        data = res.data['data']
        self.assertEqual(data['container_number'], self.container1.container_number)
        self.assertEqual(data['storage_status'], 'NOT_ALLOCATED')
        self.assertEqual(data['location_display'], 'Not allocated')
        self.assertFalse(data['has_active_allocation'])
        self.assertIsNone(data['yard_id'])
        self.assertIsNone(data['slot_id'])

    # =========================================================================
    # Test 2: Container location with active allocation
    # =========================================================================
    def test_02_current_location_with_active_allocation(self):
        # Create active allocation for container1 in slot_a01_1
        alloc = YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()
        self.block_a01.yard_block_occupied = 1
        self.block_a01.save()
        self.yard_alpha.yard_occupied = 1
        self.yard_alpha.save()

        res = self.client.get(
            f'/api/terminal/yard-operations/containers/{self.container1.container_id}/location/',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data['data']
        self.assertEqual(data['container_number'], self.container1.container_number)
        self.assertEqual(data['storage_status'], 'STORED')
        self.assertEqual(data['yard_code'], 'CY-T3-A')
        self.assertEqual(data['block_code'], 'T3-A01')
        self.assertEqual(data['slot_code'], 'T3-A01-R01-B01-T01')
        self.assertEqual(data['slot_row'], 1)
        self.assertEqual(data['slot_bay'], 1)
        self.assertEqual(data['slot_tier'], 1)
        self.assertTrue(data['has_active_allocation'])
        self.assertEqual(data['location_display'], 'CY-T3-A / T3-A01 / T3-A01-R01-B01-T01')
        self.assertIsNotNone(data['allocated_at'])

    # =========================================================================
    # Test 3: Successful relocation within same block
    # =========================================================================
    def test_03_successful_relocation_same_block(self):
        # Initially allocate container1 to slot_a01_1
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()
        self.block_a01.yard_block_occupied = 1
        self.block_a01.save()
        self.yard_alpha.yard_occupied = 1
        self.yard_alpha.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id,
            "remarks": "Moved within same block for stacking optimization"
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        self.assertIn("relocated", res.data['message'].lower())

        # Check slots status
        self.slot_a01_1.refresh_from_db()
        self.slot_a01_2.refresh_from_db()
        self.assertEqual(self.slot_a01_1.yard_slot_status, 'AVAILABLE')
        self.assertEqual(self.slot_a01_2.yard_slot_status, 'OCCUPIED')

        # Check block & yard occupancy (same block: net change must be 0)
        self.block_a01.refresh_from_db()
        self.yard_alpha.refresh_from_db()
        self.assertEqual(self.block_a01.yard_block_occupied, 1)
        self.assertEqual(self.yard_alpha.yard_occupied, 1)

        # Check YardAllocation status: previous RELEASED, new ACTIVE
        old_alloc = YardAllocation.objects.filter(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1
        ).first()
        self.assertEqual(old_alloc.yard_allocation_status, 'RELEASED')

        new_alloc = YardAllocation.objects.filter(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_2
        ).first()
        self.assertEqual(new_alloc.yard_allocation_status, 'ACTIVE')

        # Check YardMovementHistory created
        movement = YardMovementHistory.objects.filter(
            yard_movement_container_id=self.container1
        ).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.from_slot, self.slot_a01_1)
        self.assertEqual(movement.to_slot, self.slot_a01_2)
        self.assertEqual(movement.moved_by, self.user_tlo)
        self.assertIn("Moved within same block", movement.yard_movement_remarks)

        # Check Audit Log created
        self.assertTrue(
            AuditLog.objects.filter(
                audit_log_category='YARD_OPERATIONS',
                audit_log_action='RELOCATE_CONTAINER_YARD'
            ).exists()
        )

        # Verify updated location returned
        self.container1.refresh_from_db()
        self.assertEqual(
            self.container1.current_yard_location['location_display'],
            'CY-T3-A / T3-A01 / T3-A01-R01-B02-T01'
        )

    # =========================================================================
    # Test 4: Relocation same yard, different block (no yard double-counting)
    # =========================================================================
    def test_04_successful_relocation_same_yard_different_block(self):
        # Initially allocate container1 to block_a01 slot_a01_1
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()
        self.block_a01.yard_block_occupied = 1
        self.block_a01.save()
        self.block_a02.yard_block_occupied = 0
        self.block_a02.save()
        self.yard_alpha.yard_occupied = 1
        self.yard_alpha.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a02_1.yard_slot_id,
            "remarks": "Moved from Block A01 to Block A02"
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Check blocks occupancy: source decrements to 0, destination increments to 1
        self.block_a01.refresh_from_db()
        self.block_a02.refresh_from_db()
        self.assertEqual(self.block_a01.yard_block_occupied, 0)
        self.assertEqual(self.block_a02.yard_block_occupied, 1)

        # Yard Alpha occupancy stays 1 (NO DOUBLE COUNTING!)
        self.yard_alpha.refresh_from_db()
        self.assertEqual(self.yard_alpha.yard_occupied, 1)

        # Slot statuses updated
        self.slot_a01_1.refresh_from_db()
        self.slot_a02_1.refresh_from_db()
        self.assertEqual(self.slot_a01_1.yard_slot_status, 'AVAILABLE')
        self.assertEqual(self.slot_a02_1.yard_slot_status, 'OCCUPIED')

    # =========================================================================
    # Test 5: Cross-yard relocation (updates both source & destination yards)
    # =========================================================================
    def test_05_successful_relocation_cross_yard(self):
        # Initially in Yard Alpha, Block A01
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()
        self.block_a01.yard_block_occupied = 1
        self.block_a01.save()
        self.yard_alpha.yard_occupied = 1
        self.yard_alpha.save()

        self.block_b01.yard_block_occupied = 0
        self.block_b01.save()
        self.yard_beta.yard_occupied = 0
        self.yard_beta.save()

        # Move to Yard Beta, Block B01, slot_b01_1
        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_b01_1.yard_slot_id,
            "remarks": "Cross-yard transfer to Yard Beta"
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Source yard decrements to 0, destination yard increments to 1
        self.yard_alpha.refresh_from_db()
        self.yard_beta.refresh_from_db()
        self.assertEqual(self.yard_alpha.yard_occupied, 0)
        self.assertEqual(self.yard_beta.yard_occupied, 1)

        # Blocks updated accordingly
        self.block_a01.refresh_from_db()
        self.block_b01.refresh_from_db()
        self.assertEqual(self.block_a01.yard_block_occupied, 0)
        self.assertEqual(self.block_b01.yard_block_occupied, 1)

        # New location display
        self.container1.refresh_from_db()
        self.assertEqual(
            self.container1.current_yard_location['location_display'],
            'CY-T3-B / T3-B01 / T3-B01-R01-B01-T01'
        )

    # =========================================================================
    # Test 6: Relocation rejected when destination is the same slot
    # =========================================================================
    def test_06_relocation_rejected_same_slot(self):
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_1.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("same as", res.data.get('message', '').lower())

    # =========================================================================
    # Test 7: Relocation rejected when container has no active allocation
    # =========================================================================
    def test_07_relocation_rejected_container_without_active_allocation(self):
        # container1 has NO active allocation
        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("active", res.data.get('message', '').lower())

    # =========================================================================
    # Test 8: Relocation rejected when destination slot is occupied
    # =========================================================================
    def test_08_relocation_rejected_destination_slot_occupied(self):
        # Allocate container1 to slot_a01_1
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # Allocate container2 to slot_a01_2
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container2,
            yard_allocation_slot_id=self.slot_a01_2,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_2.yard_slot_status = 'OCCUPIED'
        self.slot_a01_2.save()

        # Attempt to relocate container1 to slot_a01_2 (already occupied)
        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            "occupied" in res.data.get('message', '').lower() or
            "allocatable" in res.data.get('message', '').lower()
        )

    # =========================================================================
    # Test 9: Relocation rejected when destination slot is inactive or blocked
    # =========================================================================
    def test_09_relocation_rejected_destination_slot_inactive_or_blocked(self):
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # Mark slot_a01_2 as BLOCKED
        self.slot_a01_2.yard_slot_status = 'BLOCKED'
        self.slot_a01_2.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("blocked", res.data.get('message', '').lower())

    # =========================================================================
    # Test 10: Relocation rejected when destination block is inactive
    # =========================================================================
    def test_10_relocation_rejected_inactive_destination_block(self):
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # Deactivate Block A02
        self.block_a02.yard_block_status = 'INACTIVE'
        self.block_a02.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a02_1.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data.get('message', '').lower())

    # =========================================================================
    # Test 11: Relocation rejected when destination yard is inactive
    # =========================================================================
    def test_11_relocation_rejected_inactive_destination_yard(self):
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # Deactivate Yard Beta
        self.yard_beta.yard_status = 'INACTIVE'
        self.yard_beta.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_b01_1.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data.get('message', '').lower())

    # =========================================================================
    # Test 12: Relocation rejected when destination block capacity reached
    # =========================================================================
    def test_12_relocation_rejected_destination_block_capacity_reached(self):
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # Set block_a02 capacity limit
        self.block_a02.yard_block_capacity = 5
        self.block_a02.yard_block_occupied = 5
        self.block_a02.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a02_1.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("capacity", res.data.get('message', '').lower())

    # =========================================================================
    # Test 13: Relocation rejected when destination yard capacity reached
    # =========================================================================
    def test_13_relocation_rejected_destination_yard_capacity_reached(self):
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # Set yard_beta capacity limit
        self.yard_beta.yard_capacity = 10
        self.yard_beta.yard_occupied = 10
        self.yard_beta.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_b01_1.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("capacity", res.data.get('message', '').lower())

    # =========================================================================
    # Test 14: Movement history preserves multiple relocations chronologically
    # =========================================================================
    def test_14_movement_history_preserves_multiple_relocations(self):
        # Initial allocation
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()
        self.block_a01.yard_block_occupied = 1
        self.block_a01.save()
        self.yard_alpha.yard_occupied = 1
        self.yard_alpha.save()

        # Move 1: slot_a01_1 -> slot_a01_2
        res1 = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": self.container1.container_id, "destination_slot_id": self.slot_a01_2.yard_slot_id, "remarks": "First move"},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Move 2: slot_a01_2 -> slot_a02_1
        res2 = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": self.container1.container_id, "destination_slot_id": self.slot_a02_1.yard_slot_id, "remarks": "Second move"},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        # Verify movement history has 2 distinct records
        movements = YardMovementHistory.objects.filter(
            yard_movement_container_id=self.container1
        ).order_by('yard_movement_timestamp')

        self.assertEqual(movements.count(), 2)
        m1, m2 = movements[0], movements[1]

        self.assertEqual(m1.from_slot, self.slot_a01_1)
        self.assertEqual(m1.to_slot, self.slot_a01_2)
        self.assertEqual(m1.yard_movement_remarks, "First move")

        self.assertEqual(m2.from_slot, self.slot_a01_2)
        self.assertEqual(m2.to_slot, self.slot_a02_1)
        self.assertEqual(m2.yard_movement_remarks, "Second move")

        # Container current location is at slot_a02_1
        self.container1.refresh_from_db()
        self.assertEqual(self.container1.current_yard_location['slot_code'], self.slot_a02_1.yard_slot_code)

    # =========================================================================
    # Test 15: Movement history API filtering
    # =========================================================================
    def test_15_movement_history_api_filtering(self):
        # Create a movement
        YardMovementHistory.objects.create(
            yard_movement_container_id=self.container1,
            yard_movement_from_slot_id=self.slot_a01_1,
            yard_movement_to_slot_id=self.slot_a01_2,
            yard_movement_moved_by_id=self.user_tlo,
            yard_movement_remarks="Historical transfer test"
        )

        # Query all
        res = self.client.get('/api/terminal/yard-operations/movements/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data['total'], 1)

        # Filter by container_id
        res_filtered = self.client.get(
            f'/api/terminal/yard-operations/movements/?container_id={self.container1.container_id}',
            **self.headers_tlo
        )
        self.assertEqual(res_filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_filtered.data['data']), 1)
        self.assertEqual(res_filtered.data['data'][0]['container_number'], self.container1.container_number)

    # =========================================================================
    # Test 16: Containers inventory list with storage status and search
    # =========================================================================
    def test_16_containers_inventory_and_search(self):
        # container1 active, container2 unallocated
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )

        res = self.client.get('/api/terminal/yard-operations/containers/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        self.assertGreaterEqual(res.data['total'], 2)

        # Filter storage_status=STORED
        res_stored = self.client.get('/api/terminal/yard-operations/containers/?storage_status=STORED', **self.headers_tlo)
        self.assertEqual(res_stored.status_code, status.HTTP_200_OK)
        stored_numbers = [c['container_number'] for c in res_stored.data['data']]
        self.assertIn(self.container1.container_number, stored_numbers)
        self.assertNotIn(self.container2.container_number, stored_numbers)

        # Filter storage_status=NOT_ALLOCATED
        res_unalloc = self.client.get('/api/terminal/yard-operations/containers/?storage_status=NOT_ALLOCATED', **self.headers_tlo)
        self.assertEqual(res_unalloc.status_code, status.HTTP_200_OK)
        unalloc_numbers = [c['container_number'] for c in res_unalloc.data['data']]
        self.assertIn(self.container2.container_number, unalloc_numbers)

        # Search by container number
        res_search = self.client.get(f'/api/terminal/yard-operations/containers/?search={self.container1.container_number}', **self.headers_tlo)
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_search.data['data']), 1)
        self.assertEqual(res_search.data['data'][0]['container_number'], self.container1.container_number)

    # =========================================================================
    # Test 17: Yard utilization summary endpoint
    # =========================================================================
    def test_17_yard_utilization_endpoint(self):
        self.yard_alpha.yard_occupied = 10
        self.yard_alpha.save()
        self.block_a01.yard_block_occupied = 8
        self.block_a01.save()

        res = self.client.get('/api/terminal/yard-operations/utilization/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')

        data = res.data['data']
        self.assertIn('overall', data)
        self.assertIn('yards', data)

        overall = data['overall']
        self.assertGreaterEqual(overall['total_capacity'], 150)
        self.assertGreaterEqual(overall['total_occupied'], 10)
        self.assertIn('occupancy_percentage', overall)

        # Verify yard breakdown
        alpha_yard_data = [y for y in data['yards'] if y['yard_code'] == 'CY-T3-A'][0]
        self.assertEqual(alpha_yard_data['yard_occupied'], 10)
        self.assertEqual(alpha_yard_data['occupancy_percentage'], 10.0)

        # Verify block breakdown
        a01_block_data = [b for b in alpha_yard_data['blocks'] if b['block_code'] == 'T3-A01'][0]
        self.assertEqual(a01_block_data['block_occupied'], 8)
        self.assertEqual(a01_block_data['available_capacity'], 12)

    # =========================================================================
    # Test 18: RBAC enforcement across all six user roles
    # =========================================================================
    def test_18_rbac_for_all_six_roles(self):
        # Prepare an active allocation for container1
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        relocate_payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id
        }

        # 1. Terminal & Logistics Operator: Authorized (GET & POST)
        res_tlo_get = self.client.get('/api/terminal/yard-operations/utilization/', **self.headers_tlo)
        self.assertEqual(res_tlo_get.status_code, status.HTTP_200_OK)

        # 2. Port Administrator: Authorized (GET & POST)
        res_admin_get = self.client.get('/api/terminal/yard-operations/utilization/', **self.headers_admin)
        self.assertEqual(res_admin_get.status_code, status.HTTP_200_OK)

        res_admin_post = self.client.post('/api/terminal/yard-operations/relocate/', relocate_payload, format='json', **self.headers_admin)
        self.assertEqual(res_admin_post.status_code, status.HTTP_200_OK)

        # 3. Port Operations Officer: Read-Only (Can GET, cannot POST relocate)
        res_ops_get = self.client.get('/api/terminal/yard-operations/utilization/', **self.headers_ops)
        self.assertEqual(res_ops_get.status_code, status.HTTP_200_OK)

        payload_ops_move = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a02_1.yard_slot_id
        }
        res_ops_post = self.client.post('/api/terminal/yard-operations/relocate/', payload_ops_move, format='json', **self.headers_ops)
        self.assertEqual(res_ops_post.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Shipping Company: Denied entirely
        res_ship_get = self.client.get('/api/terminal/yard-operations/utilization/', **self.headers_shipping)
        self.assertEqual(res_ship_get.status_code, status.HTTP_403_FORBIDDEN)
        res_ship_post = self.client.post('/api/terminal/yard-operations/relocate/', payload_ops_move, format='json', **self.headers_shipping)
        self.assertEqual(res_ship_post.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Customs Officer: Denied entirely
        res_cust_get = self.client.get('/api/terminal/yard-operations/utilization/', **self.headers_customs)
        self.assertEqual(res_cust_get.status_code, status.HTTP_403_FORBIDDEN)
        res_cust_post = self.client.post('/api/terminal/yard-operations/relocate/', payload_ops_move, format='json', **self.headers_customs)
        self.assertEqual(res_cust_post.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Gate Operations Officer: Denied entirely
        res_gate_get = self.client.get('/api/terminal/yard-operations/utilization/', **self.headers_gate)
        self.assertEqual(res_gate_get.status_code, status.HTTP_403_FORBIDDEN)
        res_gate_post = self.client.post('/api/terminal/yard-operations/relocate/', payload_ops_move, format='json', **self.headers_gate)
        self.assertEqual(res_gate_post.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # Test 19: Container lifecycle, customs, gate & delivery status preserved
    # =========================================================================
    def test_19_container_lifecycle_and_status_preservation(self):
        # Set container to CLEARED
        self.container1.container_status = 'CLEARED'
        self.container1.container_delivery_status = 'NOT_APPLICABLE'
        self.container1.save()

        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.container1.refresh_from_db()
        # Status must not be altered merely because of yard relocation
        self.assertEqual(self.container1.container_status, 'CLEARED')
        self.assertEqual(self.container1.container_delivery_status, 'NOT_APPLICABLE')

    # =========================================================================
    # Test 20: Validation for non-existent container and destination slot
    # =========================================================================
    def test_20_validation_nonexistent_container_and_slot(self):
        # Non-existent container
        res1 = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": 999999, "destination_slot_id": self.slot_a01_1.yard_slot_id},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Non-existent slot
        res2 = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": self.container1.container_id, "destination_slot_id": 999999},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # Test 21: Relocation with RTG equipment succeeds and records equipment
    # =========================================================================
    def test_21_relocation_with_rtg_equipment_success(self):
        rtg = Crane.objects.create(
            crane_code="RTG-TEST-01",
            crane_name="Rubber Tyred Gantry 01",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("40.00"),
            crane_status="AVAILABLE",
            crane_is_active=True
        )

        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id,
            "crane_id": rtg.crane_id,
            "remarks": "Relocation using RTG-TEST-01"
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Check YardMovementHistory created with equipment
        movement = YardMovementHistory.objects.filter(
            yard_movement_container_id=self.container1
        ).latest('yard_movement_id')
        self.assertIsNotNone(movement)
        self.assertEqual(movement.yard_movement_crane_id, rtg)
        self.assertEqual(movement.from_slot, self.slot_a01_1)
        self.assertEqual(movement.to_slot, self.slot_a01_2)

        # Verify serializer exposes equipment fields in movements endpoint
        res_history = self.client.get('/api/terminal/yard-operations/movements/', **self.headers_tlo)
        self.assertEqual(res_history.status_code, status.HTTP_200_OK)
        history_item = next(m for m in res_history.json()['data'] if m['yard_movement_id'] == movement.yard_movement_id)
        self.assertEqual(history_item['crane_id'], rtg.crane_id)
        self.assertEqual(history_item['crane_code'], 'RTG-TEST-01')
        self.assertEqual(history_item['crane_name'], 'Rubber Tyred Gantry 01')
        self.assertEqual(history_item['crane_type'], 'RTG')
        self.assertEqual(history_item['crane_type_display'], 'Rubber-Tyred Gantry (RTG) Crane')

    # =========================================================================
    # Test 22: Relocation with RMG and MHC equipment succeeds
    # =========================================================================
    def test_22_relocation_with_rmg_and_mhc_equipment_success(self):
        rmg = Crane.objects.create(
            crane_code="RMG-TEST-01",
            crane_name="Rail Mounted Gantry 01",
            crane_type="RMG",
            crane_max_lifting_capacity_mt=Decimal("50.00"),
            crane_status="AVAILABLE",
            crane_is_active=True
        )
        mhc = Crane.objects.create(
            crane_code="MHC-TEST-01",
            crane_name="Mobile Harbour Crane Yard 01",
            crane_type="MHC",
            crane_max_lifting_capacity_mt=Decimal("100.00"),
            crane_status="AVAILABLE",
            crane_is_active=True
        )

        # Test RMG relocation
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        res_rmg = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": self.container1.container_id, "destination_slot_id": self.slot_a01_2.yard_slot_id, "crane_id": rmg.crane_id},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res_rmg.status_code, status.HTTP_200_OK)

        # Test MHC relocation
        res_mhc = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": self.container1.container_id, "destination_slot_id": self.slot_a01_1.yard_slot_id, "crane_id": mhc.crane_id},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res_mhc.status_code, status.HTTP_200_OK)

    # =========================================================================
    # Test 23: Relocation strictly rejects STS quay crane
    # =========================================================================
    def test_23_relocation_rejects_sts_crane(self):
        sts = Crane.objects.create(
            crane_code="STS-YARD-REJECT",
            crane_name="Ship to Shore Quay Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE",
            crane_is_active=True
        )

        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id,
            "crane_id": sts.crane_id
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_id', res.json()['errors'])
        self.assertIn('ship-to-shore', res.json()['errors']['crane_id'][0].lower())

    # =========================================================================
    # Test 24: Relocation rejects maintenance, inactive, or in-use equipment
    # =========================================================================
    def test_24_relocation_rejects_maintenance_or_inactive_crane(self):
        maint_crane = Crane.objects.create(
            crane_code="RTG-MAINT-01",
            crane_name="Broken RTG",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("45.00"),
            crane_status="MAINTENANCE",
            crane_is_active=True
        )
        inactive_crane = Crane.objects.create(
            crane_code="RTG-INACTIVE-01",
            crane_name="Decommissioned RTG",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("45.00"),
            crane_status="AVAILABLE",
            crane_is_active=False
        )

        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # 1. Maintenance crane rejected
        res_maint = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": self.container1.container_id, "destination_slot_id": self.slot_a01_2.yard_slot_id, "crane_id": maint_crane.crane_id},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res_maint.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_id', res_maint.json()['errors'])

        # 2. Inactive crane rejected
        res_inact = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {"container_id": self.container1.container_id, "destination_slot_id": self.slot_a01_2.yard_slot_id, "crane_id": inactive_crane.crane_id},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res_inact.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_id', res_inact.json()['errors'])

    # =========================================================================
    # Test 25: Relocation without equipment remains fully supported
    # =========================================================================
    def test_25_relocation_without_equipment_supported(self):
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id,
            "crane_id": None,
            "remarks": "Relocation without equipment"
        }

        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        movement = YardMovementHistory.objects.filter(
            yard_movement_container_id=self.container1
        ).latest('yard_movement_id')
        self.assertIsNone(movement.yard_movement_crane_id)

        # Check API list returns crane fields as None / null
        res_history = self.client.get('/api/terminal/yard-operations/movements/', **self.headers_tlo)
        self.assertEqual(res_history.status_code, status.HTTP_200_OK)
        history_item = next(m for m in res_history.json()['data'] if m['yard_movement_id'] == movement.yard_movement_id)
        self.assertIsNone(history_item['crane_id'])
        self.assertIsNone(history_item['crane_code'])
        self.assertIsNone(history_item['crane_name'])

    # =========================================================================
    # Test 26: Relocation failure rolls back allocation, slot status, and occupancy
    # =========================================================================
    def test_26_relocation_failure_rolls_back_everything(self):
        # Occupy destination slot with container 2
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container2,
            yard_allocation_slot_id=self.slot_a01_2,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_2.yard_slot_status = 'OCCUPIED'
        self.slot_a01_2.save()

        # Occupy origin slot with container 1
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        init_movements_count = YardMovementHistory.objects.count()

        # Attempt to relocate container 1 into already occupied destination slot
        payload = {
            "container_id": self.container1.container_id,
            "destination_slot_id": self.slot_a01_2.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-operations/relocate/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify rollback: origin slot remains OCCUPIED, destination remains OCCUPIED by container 2
        self.slot_a01_1.refresh_from_db()
        self.slot_a01_2.refresh_from_db()
        self.assertEqual(self.slot_a01_1.yard_slot_status, 'OCCUPIED')
        self.assertEqual(self.slot_a01_2.yard_slot_status, 'OCCUPIED')

        # Active allocation for container 1 still points to slot_a01_1
        active_alloc = YardAllocation.objects.filter(
            yard_allocation_container_id=self.container1,
            yard_allocation_status='ACTIVE'
        ).first()
        self.assertEqual(active_alloc.yard_allocation_slot_id, self.slot_a01_1)

        # No new movement history record created
        self.assertEqual(YardMovementHistory.objects.count(), init_movements_count)

    # =========================================================================
    # Test 27: Relocation rejects in-use or actively vessel-allocated equipment
    # =========================================================================
    def test_27_relocation_rejects_in_use_or_actively_allocated_crane(self):
        in_use_crane = Crane.objects.create(
            crane_code="RTG-INUSE-01",
            crane_name="Currently In-Use RTG",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("45.00"),
            crane_status="IN_USE",
            crane_is_active=True
        )

        allocated_crane = Crane.objects.create(
            crane_code="MHC-ALLOC-01",
            crane_name="Currently Allocated MHC",
            crane_type="MHC",
            crane_max_lifting_capacity_mt=Decimal("80.00"),
            crane_status="AVAILABLE",
            crane_is_active=True
        )

        now = timezone.now()
        berth = Berth.objects.create(
            berth_name="Quay Berth T3-Test",
            berth_code="QB-T3-TEST",
            berth_type="CONTAINER_TERMINAL",
            berth_max_length=Decimal("300.00"),
            berth_max_draft=Decimal("14.00"),
            berth_status="AVAILABLE",
            berth_is_active=True
        )
        vessel_sched = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival,
            vessel_schedule_berth_id=berth,
            vessel_schedule_scheduled_arrival_at=now,
            vessel_schedule_scheduled_departure_at=now + timezone.timedelta(hours=12),
            vessel_schedule_status='BERTHED',
            vessel_schedule_created_by=self.user_tlo
        )
        CraneAllocation.objects.create(
            crane_allocation_crane_id=allocated_crane,
            crane_allocation_vessel_schedule_id=vessel_sched,
            crane_allocation_berth_id=berth,
            crane_allocation_operation_type='UNLOADING',
            crane_allocation_status='ACTIVE',
            crane_allocation_planned_start_at=now,
            crane_allocation_planned_end_at=now + timezone.timedelta(hours=4),
            crane_allocation_assigned_by_id=self.user_tlo
        )

        # Place container1 in slot_a01_1
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot_a01_1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot_a01_1.yard_slot_status = 'OCCUPIED'
        self.slot_a01_1.save()

        # 1. Relocation with IN_USE crane rejected
        res_in_use = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {
                "container_id": self.container1.container_id,
                "destination_slot_id": self.slot_a01_2.yard_slot_id,
                "crane_id": in_use_crane.crane_id
            },
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res_in_use.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_id', res_in_use.json()['errors'])
        self.assertIn('in_use', res_in_use.json()['errors']['crane_id'][0].lower())

        # 2. Relocation with active vessel allocated crane rejected
        res_alloc = self.client.post(
            '/api/terminal/yard-operations/relocate/',
            {
                "container_id": self.container1.container_id,
                "destination_slot_id": self.slot_a01_2.yard_slot_id,
                "crane_id": allocated_crane.crane_id
            },
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res_alloc.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_id', res_alloc.json()['errors'])
        self.assertIn('actively allocated', res_alloc.json()['errors']['crane_id'][0].lower())

    # =========================================================================
    # Test 28: Destination Block and Slot Loading & Filtering for Relocation Modal
    # =========================================================================
    def test_28_destination_block_and_slot_loading_for_relocation(self):
        """
        Verify that:
        1. GET /api/terminal/yards/ serializes nested blocks list in each yard item.
        2. GET /api/terminal/yards/<yard_id>/blocks/?status=ACTIVE returns only active blocks belonging to that yard.
        3. Inactive blocks are excluded when filtering status=ACTIVE.
        4. GET /api/terminal/yard-allocations/available-slots/?block_id=<block_id> returns only available slots in that block.
        """
        # Create an inactive block in yard_alpha
        YardBlock.objects.create(
            yard_block_yard_id=self.yard_alpha,
            yard_block_name="Decommissioned Block A99",
            yard_block_code="A99",
            yard_block_type="STANDARD",
            yard_block_status="INACTIVE",
            yard_block_capacity=50,
            yard_block_occupied=0
        )

        # 1. Test Yards list includes blocks
        res_yards = self.client.get('/api/terminal/yards/?status=ACTIVE', **self.headers_tlo)
        self.assertEqual(res_yards.status_code, status.HTTP_200_OK)
        yards_data = res_yards.json()['data']
        alpha_yard = next(y for y in yards_data if y['yard_id'] == self.yard_alpha.yard_id)
        self.assertIn('blocks', alpha_yard)
        self.assertTrue(len(alpha_yard['blocks']) >= 1)

        # 2. Test dedicated blocks endpoint for yard_alpha with status=ACTIVE
        res_blocks = self.client.get(
            f'/api/terminal/yards/{self.yard_alpha.yard_id}/blocks/?status=ACTIVE',
            **self.headers_tlo
        )
        self.assertEqual(res_blocks.status_code, status.HTTP_200_OK)
        blocks_data = res_blocks.json()['data']
        block_codes = [b['yard_block_code'] for b in blocks_data]
        self.assertIn(self.block_a01.yard_block_code, block_codes)
        self.assertNotIn('A99', block_codes)  # Inactive block excluded
        # Ensure all returned blocks belong to yard_alpha
        for b in blocks_data:
            self.assertEqual(b['yard_block_yard_id'], self.yard_alpha.yard_id)
            self.assertEqual(b['yard_block_status'], 'ACTIVE')

        # 3. Test dedicated blocks endpoint for yard_beta
        res_beta_blocks = self.client.get(
            f'/api/terminal/yards/{self.yard_beta.yard_id}/blocks/?status=ACTIVE',
            **self.headers_tlo
        )
        self.assertEqual(res_beta_blocks.status_code, status.HTTP_200_OK)
        beta_blocks_data = res_beta_blocks.json()['data']
        beta_block_codes = [b['yard_block_code'] for b in beta_blocks_data]
        self.assertIn(self.block_b01.yard_block_code, beta_block_codes)
        self.assertNotIn(self.block_a01.yard_block_code, beta_block_codes)

        # 4. Test Available Slots loading for block_a01
        res_slots = self.client.get(
            f'/api/terminal/yard-allocations/available-slots/?block_id={self.block_a01.yard_block_id}',
            **self.headers_tlo
        )
        self.assertEqual(res_slots.status_code, status.HTTP_200_OK)
        slots_data = res_slots.json()['data']
        slot_ids = [s['yard_slot_id'] for s in slots_data]
        # Both slot_a01_1 and slot_a01_2 are initially AVAILABLE
        self.assertIn(self.slot_a01_1.yard_slot_id, slot_ids)
        self.assertIn(self.slot_a01_2.yard_slot_id, slot_ids)
        for s in slots_data:
            self.assertEqual(s['block_id'], self.block_a01.yard_block_id)
            self.assertEqual(s['yard_slot_status'], 'AVAILABLE')


