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
    AuditLog
)


class YardAllocationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Terminal & Logistics Operator User
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

        # 2. Port Administrator User
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
            shipping_company_name="Ocean Express Lines",
            shipping_company_license_number="LIC-OCN-01",
            shipping_company_email="agent@oceanexpress.com",
            shipping_company_phone="+919876543204",
            shipping_company_address="Port Pier 4",
            shipping_company_jurisdiction="West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_shipping = Login.objects.create(
            login_email="agent@oceanexpress.com",
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
            'HTTP_X_USER_EMAIL': 'agent@oceanexpress.com',
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
            vessel_imo_number="9123456",
            defaults={
                "vessel_shipping_company_id": self.company,
                "vessel_name": "Pacific Navigator",
                "vessel_type": "Container Ship",
                "vessel_flag": "Liberia",
                "vessel_length": Decimal("300.00"),
                "vessel_draft": Decimal("12.50"),
                "vessel_capacity": 10000
            }
        )

        now = timezone.now()
        self.arrival = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=100,
            vessel_arrival_request_status="APPROVED"
        )

        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival,
            cargo_description="Electronics & Components",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1500.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        self.container1, _ = Container.objects.get_or_create(
            container_number="MSKU1234567",
            defaults={
                "container_cargo_id": self.cargo,
                "container_type": "20FT",
                "container_gross_weight": Decimal("18.50"),
                "container_status": "AT_TERMINAL"
            }
        )
        self.container1.container_status = "AT_TERMINAL"
        self.container1.save()

        self.container2, _ = Container.objects.get_or_create(
            container_number="MEDU9876543",
            defaults={
                "container_cargo_id": self.cargo,
                "container_type": "40FT",
                "container_gross_weight": Decimal("28.00"),
                "container_status": "AT_TERMINAL"
            }
        )
        self.container2.container_status = "AT_TERMINAL"
        self.container2.save()

        # Setup Yard Hierarchy: Yard -> Block -> Slots
        self.yard, _ = Yard.objects.get_or_create(
            yard_code="CY-ALPHA",
            defaults={
                "yard_name": "Main Terminal Container Yard Alpha",
                "yard_type": "CONTAINER_YARD",
                "yard_capacity": 100,
                "yard_occupied": 0,
                "yard_status": "ACTIVE"
            }
        )
        self.yard.yard_status = "ACTIVE"
        self.yard.yard_occupied = 0
        self.yard.save()

        self.block, _ = YardBlock.objects.get_or_create(
            yard_block_yard_id=self.yard,
            yard_block_code="A01",
            defaults={
                "yard_block_name": "North Stacking Block A01",
                "yard_block_type": "STANDARD",
                "yard_block_capacity": 20,
                "yard_block_occupied": 0,
                "yard_block_status": "ACTIVE"
            }
        )
        self.block.yard_block_status = "ACTIVE"
        self.block.yard_block_occupied = 0
        self.block.save()

        self.slot1, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=self.block,
            yard_slot_code="A01-R01-B01-T01",
            defaults={
                "yard_slot_row": 1,
                "yard_slot_bay": 1,
                "yard_slot_tier": 1,
                "yard_slot_status": "AVAILABLE"
            }
        )
        self.slot1.yard_slot_status = "AVAILABLE"
        self.slot1.save()

        self.slot2, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=self.block,
            yard_slot_code="A01-R01-B02-T01",
            defaults={
                "yard_slot_row": 1,
                "yard_slot_bay": 2,
                "yard_slot_tier": 1,
                "yard_slot_status": "AVAILABLE"
            }
        )
        self.slot2.yard_slot_status = "AVAILABLE"
        self.slot2.save()

        # Clean existing allocations for these test containers and slots
        YardAllocation.objects.filter(
            yard_allocation_container_id__in=[self.container1, self.container2]
        ).delete()
        YardAllocation.objects.filter(
            yard_allocation_slot_id__in=[self.slot1, self.slot2]
        ).delete()

    # =========================================================================
    # Test 1: Pending container retrieval
    # =========================================================================
    def test_01_pending_containers_retrieval(self):
        res = self.client.get('/api/terminal/yard-allocations/pending/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        self.assertIn('data', res.data)
        container_numbers = [c['container_number'] for c in res.data['data']]
        self.assertIn(self.container1.container_number, container_numbers)
        self.assertIn(self.container2.container_number, container_numbers)

    # =========================================================================
    # Test 2: Eligible container appears in pending list
    # =========================================================================
    def test_02_eligible_container_appears_in_pending_list(self):
        res = self.client.get('/api/terminal/yard-allocations/pending/?search=MSKU1234567', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['data']), 1)
        item = res.data['data'][0]
        self.assertEqual(item['container_number'], 'MSKU1234567')
        self.assertEqual(item['container_type'], '20FT')
        self.assertEqual(item['vessel_name'], 'Pacific Navigator')
        self.assertEqual(item['allocation_status'], 'UNALLOCATED')

    # =========================================================================
    # Test 3: Already allocated container does not appear as pending
    # =========================================================================
    def test_03_already_allocated_container_not_in_pending(self):
        # Allocate container1
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot1.yard_slot_status = 'OCCUPIED'
        self.slot1.save()

        res = self.client.get('/api/terminal/yard-allocations/pending/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        container_numbers = [c['container_number'] for c in res.data['data']]
        self.assertNotIn(self.container1.container_number, container_numbers)
        self.assertIn(self.container2.container_number, container_numbers)

    # =========================================================================
    # Test 4: Available slot retrieval
    # =========================================================================
    def test_04_available_slots_retrieval(self):
        res = self.client.get('/api/terminal/yard-allocations/available-slots/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        slot_codes = [s['yard_slot_code'] for s in res.data['data']]
        self.assertIn('A01-R01-B01-T01', slot_codes)
        self.assertIn('A01-R01-B02-T01', slot_codes)

        # Filter by block
        res_block = self.client.get(f'/api/terminal/yard-allocations/available-slots/?block_id={self.block.yard_block_id}', **self.headers_tlo)
        self.assertEqual(res_block.status_code, status.HTTP_200_OK)
        block_slot_codes = [s['yard_slot_code'] for s in res_block.data['data']]
        self.assertIn('A01-R01-B01-T01', block_slot_codes)
        self.assertIn('A01-R01-B02-T01', block_slot_codes)
        self.assertGreaterEqual(len(res_block.data['data']), 2)

    # =========================================================================
    # Test 5: Inactive yard rejected
    # =========================================================================
    def test_05_inactive_yard_rejected(self):
        inactive_yard, _ = Yard.objects.get_or_create(
            yard_code="CY-INACT-TEST-YD",
            defaults={
                "yard_name": "Inactive Yard Test",
                "yard_type": "CONTAINER_YARD",
                "yard_capacity": 50,
                "yard_occupied": 0,
                "yard_status": "INACTIVE"
            }
        )
        inactive_yard.yard_status = "INACTIVE"
        inactive_yard.save()

        inactive_block, _ = YardBlock.objects.get_or_create(
            yard_block_yard_id=inactive_yard,
            yard_block_code="B-INACT-T",
            defaults={
                "yard_block_name": "Block Inactive Yard",
                "yard_block_type": "STANDARD",
                "yard_block_capacity": 10,
                "yard_block_occupied": 0,
                "yard_block_status": "ACTIVE"
            }
        )
        slot_in_inactive_yard, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=inactive_block,
            yard_slot_code="B-INACT-01",
            defaults={
                "yard_slot_row": 1,
                "yard_slot_bay": 1,
                "yard_slot_tier": 1,
                "yard_slot_status": "AVAILABLE"
            }
        )

        payload = {
            "container_id": self.container1.container_id,
            "slot_id": slot_in_inactive_yard.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data.get('message', '').lower())

    # =========================================================================
    # Test 6: Inactive block rejected
    # =========================================================================
    def test_06_inactive_block_rejected(self):
        inactive_block, _ = YardBlock.objects.get_or_create(
            yard_block_yard_id=self.yard,
            yard_block_code="INACT-BLK-T",
            defaults={
                "yard_block_name": "Inactive Block Test",
                "yard_block_type": "STANDARD",
                "yard_block_capacity": 10,
                "yard_block_occupied": 0,
                "yard_block_status": "INACTIVE"
            }
        )
        inactive_block.yard_block_status = "INACTIVE"
        inactive_block.save()

        slot_in_inactive_block, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=inactive_block,
            yard_slot_code="INACT-BLK-01",
            defaults={
                "yard_slot_row": 1,
                "yard_slot_bay": 1,
                "yard_slot_tier": 1,
                "yard_slot_status": "AVAILABLE"
            }
        )

        payload = {
            "container_id": self.container1.container_id,
            "slot_id": slot_in_inactive_block.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("block", res.data.get('message', '').lower())

    # =========================================================================
    # Test 7: Inactive slot rejected
    # =========================================================================
    def test_07_inactive_slot_rejected(self):
        inactive_slot, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=self.block,
            yard_slot_code="A01-INACTIVE",
            defaults={
                "yard_slot_row": 1,
                "yard_slot_bay": 3,
                "yard_slot_tier": 1,
                "yard_slot_status": "INACTIVE"
            }
        )
        inactive_slot.yard_slot_status = "INACTIVE"
        inactive_slot.save()

        payload = {
            "container_id": self.container1.container_id,
            "slot_id": inactive_slot.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data.get('message', '').lower())

    # =========================================================================
    # Test 8: Blocked slot rejected
    # =========================================================================
    def test_08_blocked_slot_rejected(self):
        blocked_slot, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=self.block,
            yard_slot_code="A01-BLOCKED",
            defaults={
                "yard_slot_row": 1,
                "yard_slot_bay": 4,
                "yard_slot_tier": 1,
                "yard_slot_status": "BLOCKED"
            }
        )
        blocked_slot.yard_slot_status = "BLOCKED"
        blocked_slot.save()

        payload = {
            "container_id": self.container1.container_id,
            "slot_id": blocked_slot.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("available", res.data.get('message', '').lower())

    # =========================================================================
    # Test 9: Occupied slot rejected
    # =========================================================================
    def test_09_occupied_slot_rejected(self):
        self.slot1.yard_slot_status = "OCCUPIED"
        self.slot1.save()

        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("available", res.data.get('message', '').lower())

    # =========================================================================
    # Test 10: Reserved slot rejected
    # =========================================================================
    def test_10_reserved_slot_rejected(self):
        reserved_slot, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=self.block,
            yard_slot_code="A01-RESERVED",
            defaults={
                "yard_slot_row": 1,
                "yard_slot_bay": 5,
                "yard_slot_tier": 1,
                "yard_slot_status": "RESERVED"
            }
        )
        reserved_slot.yard_slot_status = "RESERVED"
        reserved_slot.save()

        payload = {
            "container_id": self.container1.container_id,
            "slot_id": reserved_slot.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("available", res.data.get('message', '').lower())

    # =========================================================================
    # Test 11: Successful allocation
    # =========================================================================
    def test_11_successful_allocation(self):
        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id,
            "remarks": "Allocated by test suite"
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'success')
        self.assertEqual(res.data['data']['yard_allocation_status'], 'ACTIVE')
        self.assertEqual(res.data['data']['container_number'], 'MSKU1234567')
        self.assertEqual(res.data['data']['yard_slot_code'], 'A01-R01-B01-T01')
        self.assertEqual(res.data['data']['current_location'], 'CY-ALPHA / A01 / A01-R01-B01-T01')

    # =========================================================================
    # Test 12: Duplicate active allocation rejected
    # =========================================================================
    def test_12_duplicate_active_allocation_rejected(self):
        # First allocation
        payload1 = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res1 = self.client.post('/api/terminal/yard-allocations/', payload1, format='json', **self.headers_tlo)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Attempt second allocation for the same container to slot2
        payload2 = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot2.yard_slot_id
        }
        res2 = self.client.post('/api/terminal/yard-allocations/', payload2, format='json', **self.headers_tlo)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("active", res2.data.get('message', '').lower())

    # =========================================================================
    # Test 13: Slot occupancy updated
    # =========================================================================
    def test_13_slot_occupancy_updated(self):
        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.slot1.refresh_from_db()
        self.assertEqual(self.slot1.yard_slot_status, 'OCCUPIED')

    # =========================================================================
    # Test 14: Block occupancy updated
    # =========================================================================
    def test_14_block_occupancy_updated(self):
        initial_block_occ = self.block.yard_block_occupied
        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.block.refresh_from_db()
        self.assertEqual(self.block.yard_block_occupied, initial_block_occ + 1)

    # =========================================================================
    # Test 15: Yard occupancy updated
    # =========================================================================
    def test_15_yard_occupancy_updated(self):
        initial_yard_occ = self.yard.yard_occupied
        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.yard.refresh_from_db()
        self.assertEqual(self.yard.yard_occupied, initial_yard_occ + 1)

    # =========================================================================
    # Test 16: Current location returned correctly
    # =========================================================================
    def test_16_current_location_returned_correctly(self):
        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)

        # Check Container API
        res_container = self.client.get(f'/api/containers/{self.container1.container_id}/', **self.headers_tlo)
        self.assertEqual(res_container.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res_container.data['data']['yard_location'])
        self.assertEqual(res_container.data['data']['yard_location']['location_display'], 'CY-ALPHA / A01 / A01-R01-B01-T01')

        # Check Container model property directly
        self.container1.refresh_from_db()
        self.assertIsNotNone(self.container1.current_yard_location)
        self.assertEqual(self.container1.current_yard_location['location_display'], 'CY-ALPHA / A01 / A01-R01-B01-T01')
        self.assertEqual(self.container1.active_yard_allocation.location_display, 'CY-ALPHA / A01 / A01-R01-B01-T01')

    # =========================================================================
    # Test 17: Allocation history preserved
    # =========================================================================
    def test_17_allocation_history_preserved(self):
        # 1. Allocate container1 to slot1
        alloc = YardAllocation.objects.create(
            yard_allocation_container_id=self.container1,
            yard_allocation_slot_id=self.slot1,
            yard_allocation_status='ACTIVE',
            yard_allocation_allocated_by_id=self.user_tlo
        )
        self.slot1.yard_slot_status = 'OCCUPIED'
        self.slot1.save()
        self.block.yard_block_occupied = 1
        self.block.save()
        self.yard.yard_occupied = 1
        self.yard.save()

        # 2. Release allocation
        release_res = self.client.post(
            f'/api/terminal/yard-allocations/{alloc.yard_allocation_id}/release/',
            {"remarks": "Released for delivery"},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(release_res.status_code, status.HTTP_200_OK)
        self.assertEqual(release_res.data['data']['yard_allocation_status'], 'RELEASED')

        # 3. Query history list
        res_history = self.client.get('/api/terminal/yard-allocations/', **self.headers_tlo)
        self.assertEqual(res_history.status_code, status.HTTP_200_OK)
        alloc_ids = [a['yard_allocation_id'] for a in res_history.data['data']]
        self.assertIn(alloc.yard_allocation_id, alloc_ids)

        released_record = [a for a in res_history.data['data'] if a['yard_allocation_id'] == alloc.yard_allocation_id][0]
        self.assertEqual(released_record['yard_allocation_status'], 'RELEASED')
        self.assertIsNotNone(released_record['yard_allocation_released_at'])
        self.assertIn('Released for delivery', released_record['remarks'])

    # =========================================================================
    # Test 18: Release updates slot and occupancy correctly
    # =========================================================================
    def test_18_release_updates_slot_and_occupancy_correctly(self):
        # Allocate first
        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res_alloc = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        alloc_id = res_alloc.data['data']['yard_allocation_id']

        self.slot1.refresh_from_db()
        self.block.refresh_from_db()
        self.yard.refresh_from_db()
        self.assertEqual(self.slot1.yard_slot_status, 'OCCUPIED')
        self.assertEqual(self.block.yard_block_occupied, 1)
        self.assertEqual(self.yard.yard_occupied, 1)

        # Release
        res_rel = self.client.post(f'/api/terminal/yard-allocations/{alloc_id}/release/', {}, format='json', **self.headers_tlo)
        self.assertEqual(res_rel.status_code, status.HTTP_200_OK)

        self.slot1.refresh_from_db()
        self.block.refresh_from_db()
        self.yard.refresh_from_db()
        self.assertEqual(self.slot1.yard_slot_status, 'AVAILABLE')
        self.assertEqual(self.block.yard_block_occupied, 0)
        self.assertEqual(self.yard.yard_occupied, 0)

    # =========================================================================
    # Test 19: RBAC for all six roles
    # =========================================================================
    def test_19_rbac_for_all_six_roles(self):
        # 1. Terminal & Logistics Operator: Full access (tested in create & release above)
        res_tlo = self.client.get('/api/terminal/yard-allocations/', **self.headers_tlo)
        self.assertEqual(res_tlo.status_code, status.HTTP_200_OK)

        # 2. Port Administrator: Full access
        res_admin_get = self.client.get('/api/terminal/yard-allocations/', **self.headers_admin)
        self.assertEqual(res_admin_get.status_code, status.HTTP_200_OK)

        payload_admin = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res_admin_post = self.client.post('/api/terminal/yard-allocations/', payload_admin, format='json', **self.headers_admin)
        self.assertEqual(res_admin_post.status_code, status.HTTP_201_CREATED)
        alloc_id = res_admin_post.data['data']['yard_allocation_id']

        # 3. Port Operations Officer: Read-Only (Can GET, cannot POST/RELEASE)
        res_ops_get = self.client.get('/api/terminal/yard-allocations/', **self.headers_ops)
        self.assertEqual(res_ops_get.status_code, status.HTTP_200_OK)

        payload_ops = {
            "container_id": self.container2.container_id,
            "slot_id": self.slot2.yard_slot_id
        }
        res_ops_post = self.client.post('/api/terminal/yard-allocations/', payload_ops, format='json', **self.headers_ops)
        self.assertEqual(res_ops_post.status_code, status.HTTP_403_FORBIDDEN)

        res_ops_rel = self.client.post(f'/api/terminal/yard-allocations/{alloc_id}/release/', {}, format='json', **self.headers_ops)
        self.assertEqual(res_ops_rel.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Shipping Company: Denied
        res_ship_get = self.client.get('/api/terminal/yard-allocations/', **self.headers_shipping)
        self.assertEqual(res_ship_get.status_code, status.HTTP_403_FORBIDDEN)
        res_ship_post = self.client.post('/api/terminal/yard-allocations/', payload_admin, format='json', **self.headers_shipping)
        self.assertEqual(res_ship_post.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Customs Officer: Denied
        res_cust_get = self.client.get('/api/terminal/yard-allocations/', **self.headers_customs)
        self.assertEqual(res_cust_get.status_code, status.HTTP_403_FORBIDDEN)
        res_cust_post = self.client.post('/api/terminal/yard-allocations/', payload_admin, format='json', **self.headers_customs)
        self.assertEqual(res_cust_post.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Gate Operations Officer: Denied
        res_gate_get = self.client.get('/api/terminal/yard-allocations/', **self.headers_gate)
        self.assertEqual(res_gate_get.status_code, status.HTTP_403_FORBIDDEN)
        res_gate_post = self.client.post('/api/terminal/yard-allocations/', payload_admin, format='json', **self.headers_gate)
        self.assertEqual(res_gate_post.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # Test 20: Existing container / customs / delivery rules preserved
    # =========================================================================
    def test_20_existing_lifecycle_and_rules_preservation(self):
        """Allocation does not bypass or alter existing customs or delivery tracking status."""
        self.assertEqual(self.container1.container_status, 'AT_TERMINAL')
        initial_delivery_status = self.container1.container_delivery_status

        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.container1.refresh_from_db()
        # Container core status lifecycle must remain intact
        self.assertEqual(self.container1.container_status, 'AT_TERMINAL')
        # Delivery tracking status must not be arbitrarily modified
        self.assertEqual(self.container1.container_delivery_status, initial_delivery_status)
        # Audit log category and action recorded
        self.assertTrue(
            AuditLog.objects.filter(
                audit_log_category='YARD_ALLOCATION',
                audit_log_action='ALLOCATE_CONTAINER_YARD'
            ).exists()
        )

    # =========================================================================
    # Test 21: Discharged container absent from pending, present in active
    # =========================================================================
    def test_21_discharged_container_absent_from_pending_and_present_in_active(self):
        """Once allocated, container is absent from pending and present in active allocations."""
        # 1. Before allocation: container1 is in pending
        res_pending_before = self.client.get('/api/terminal/yard-allocations/pending/', **self.headers_tlo)
        self.assertEqual(res_pending_before.status_code, status.HTTP_200_OK)
        pending_ids_before = [c['container_id'] for c in res_pending_before.data['data']]
        self.assertIn(self.container1.container_id, pending_ids_before)

        # 2. Allocate container1 to slot1
        payload = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res_alloc = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res_alloc.status_code, status.HTTP_201_CREATED)

        # 3. After allocation: container1 is ABSENT from pending
        res_pending_after = self.client.get('/api/terminal/yard-allocations/pending/', **self.headers_tlo)
        self.assertEqual(res_pending_after.status_code, status.HTTP_200_OK)
        pending_ids_after = [c['container_id'] for c in res_pending_after.data['data']]
        self.assertNotIn(self.container1.container_id, pending_ids_after)

        # 4. Container1 is PRESENT in active allocations
        res_active = self.client.get('/api/terminal/yard-allocations/?status=ACTIVE', **self.headers_tlo)
        self.assertEqual(res_active.status_code, status.HTTP_200_OK)
        active_container_ids = [a['container_id'] for a in res_active.data['data']]
        self.assertIn(self.container1.container_id, active_container_ids)

    # =========================================================================
    # Test 22: Container on scheduled (un-arrived) vessel is absent from pending
    # =========================================================================
    def test_22_container_on_scheduled_vessel_absent_from_pending(self):
        """Containers belonging to vessels that are SCHEDULED (not yet arrived) must not appear in pending."""
        # Create a vessel arrival request with SCHEDULED status
        now = timezone.now()
        scheduled_arrival = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=5),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=7),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=50,
            vessel_arrival_request_status="SCHEDULED"
        )
        scheduled_cargo = Cargo.objects.create(
            cargo_arrival_request_id=scheduled_arrival,
            cargo_description="Scheduled Inbound Cargo",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("50.00"),
            cargo_weight=Decimal("500.00"),
            cargo_status="REGISTERED"
        )
        scheduled_container = Container.objects.create(
            container_cargo_id=scheduled_cargo,
            container_number="SCHU1234567",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="REGISTERED"
        )

        res_pending = self.client.get('/api/terminal/yard-allocations/pending/', **self.headers_tlo)
        self.assertEqual(res_pending.status_code, status.HTTP_200_OK)
        pending_ids = [c['container_id'] for c in res_pending.data['data']]
        self.assertNotIn(scheduled_container.container_id, pending_ids)

    # =========================================================================
    # Test 23: Container cannot be allocated to two active slots
    # =========================================================================
    def test_23_cannot_allocate_container_to_two_active_slots(self):
        """Prevent assigning one container to multiple active slots."""
        # 1. Allocate to slot1
        payload1 = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot1.yard_slot_id
        }
        res1 = self.client.post('/api/terminal/yard-allocations/', payload1, format='json', **self.headers_tlo)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # 2. Attempt allocating the same container to slot2
        payload2 = {
            "container_id": self.container1.container_id,
            "slot_id": self.slot2.yard_slot_id
        }
        res2 = self.client.post('/api/terminal/yard-allocations/', payload2, format='json', **self.headers_tlo)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already has an active yard allocation", res2.data['message'])

        # slot2 remains AVAILABLE
        self.slot2.refresh_from_db()
        self.assertEqual(self.slot2.yard_slot_status, 'AVAILABLE')

    # =========================================================================
    # Test 24: Manual allocation advances registered container and creates movement
    # =========================================================================
    def test_24_manual_allocation_advances_registered_status_and_creates_movement_history(self):
        """Manual allocation advances REGISTERED/ARRIVED to AT_TERMINAL and logs YARD_ALLOCATION movement."""
        self.container2.container_status = 'REGISTERED'
        self.container2.save()

        payload = {
            "container_id": self.container2.container_id,
            "slot_id": self.slot2.yard_slot_id,
            "remarks": "Manual initial yard placement"
        }
        res = self.client.post('/api/terminal/yard-allocations/', payload, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.container2.refresh_from_db()
        self.assertEqual(self.container2.container_status, 'AT_TERMINAL')

        # Check movement history record
        movement = YardMovementHistory.objects.filter(
            yard_movement_container_id=self.container2,
            yard_movement_movement_type='YARD_ALLOCATION'
        ).first()
        self.assertIsNotNone(movement)
        self.assertIsNone(movement.yard_movement_from_slot_id)
        self.assertEqual(movement.from_location_display, 'Gate-In / Yard Receiving')
        self.assertEqual(movement.yard_movement_to_slot_id, self.slot2)
        self.assertEqual(movement.yard_movement_moved_by_id, self.user_tlo)

