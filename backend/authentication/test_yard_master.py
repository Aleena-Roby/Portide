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
    Container,
    Yard,
    YardBlock,
    YardSlot,
    YardAllocation,
    AuditLog
)


class YardMasterTestCase(TestCase):
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
        self.headers_customs = {
            'HTTP_X_USER_EMAIL': 'customs@portide.com',
            'HTTP_X_USER_ROLE': 'customs_officer',
            'HTTP_X_USER_ID': str(self.login_customs.login_id)
        }

        # 6. Gate Officer (Denied)
        self.login_gate = Login.objects.create(
            login_email="gate@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.headers_gate = {
            'HTTP_X_USER_EMAIL': 'gate@portide.com',
            'HTTP_X_USER_ROLE': 'gate_truck_officer',
            'HTTP_X_USER_ID': str(self.login_gate.login_id)
        }

        # Vessel & Arrival for test containers
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="Master Vessel",
            vessel_imo_number="IMO9998881",
            vessel_type="Container Ship",
            vessel_flag="Liberia",
            vessel_length=300,
            vessel_draft=12,
            vessel_capacity=5000
        )
        self.arrival = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=timezone.now(),
            vessel_arrival_request_requested_departure_at=timezone.now(),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=100,
            vessel_arrival_request_status="APPROVED"
        )

    # =========================================================================
    # YARD TESTS
    # =========================================================================

    def test_create_yard_success(self):
        payload = {
            "yard_name": "Main Container Yard Alpha",
            "yard_code": "CY-NEW-ALPHA",
            "yard_type": "CONTAINER_YARD",
            "yard_capacity": 500,
            "yard_occupied": 50
        }
        response = self.client.post('/api/terminal/yards/', payload, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        data = response.data['data']
        self.assertEqual(data['yard_code'], 'CY-NEW-ALPHA')
        self.assertEqual(data['available_capacity'], 450)
        self.assertEqual(data['occupancy_percentage'], 10.0)
        self.assertEqual(data['yard_status'], 'ACTIVE')
        self.assertTrue(data['is_operational'])

        # Verify DB and audit log
        self.assertTrue(Yard.objects.filter(yard_code='CY-NEW-ALPHA').exists())
        self.assertTrue(AuditLog.objects.filter(audit_log_action='CREATE_YARD').exists())

    def test_create_yard_duplicate_code(self):
        Yard.objects.create(
            yard_name="Existing Yard",
            yard_code="CY-EXIST",
            yard_type="CONTAINER_YARD",
            yard_capacity=100
        )
        payload = {
            "yard_name": "Another Yard With Same Code",
            "yard_code": "CY-EXIST",
            "yard_type": "REEFER_YARD",
            "yard_capacity": 200
        }
        response = self.client.post('/api/terminal/yards/', payload, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('yard_code', response.data['errors'])

    def test_create_yard_invalid_capacity(self):
        # Capacity zero
        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "Zero Cap Yard",
            "yard_code": "CY-ZERO",
            "yard_type": "CONTAINER_YARD",
            "yard_capacity": 0
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Capacity negative
        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "Neg Cap Yard",
            "yard_code": "CY-NEG",
            "yard_type": "CONTAINER_YARD",
            "yard_capacity": -50
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_yard_capacity_and_occupied_validation(self):
        # Occupied negative
        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "Neg Occupied Yard",
            "yard_code": "CY-NEGOCC",
            "yard_type": "CONTAINER_YARD",
            "yard_capacity": 100,
            "yard_occupied": -10
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Occupied exceeds capacity
        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "Overfilled Yard",
            "yard_code": "CY-OVER",
            "yard_type": "CONTAINER_YARD",
            "yard_capacity": 100,
            "yard_occupied": 150
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_edit_yard(self):
        yard = Yard.objects.create(
            yard_name="Old Yard Name",
            yard_code="CY-EDIT",
            yard_type="CONTAINER_YARD",
            yard_capacity=100,
            yard_occupied=10
        )
        response = self.client.patch(f'/api/terminal/yards/{yard.yard_id}/', {
            "yard_name": "Updated Yard Name",
            "yard_capacity": 200
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        yard.refresh_from_db()
        self.assertEqual(yard.yard_name, "Updated Yard Name")
        self.assertEqual(yard.yard_capacity, 200)
        self.assertEqual(yard.available_capacity, 190)

    def test_toggle_yard_status(self):
        yard = Yard.objects.create(
            yard_name="Active Yard",
            yard_code="CY-TOGGLE",
            yard_type="CONTAINER_YARD",
            yard_status="ACTIVE",
            yard_capacity=100
        )
        # Toggle to INACTIVE
        response = self.client.post(f'/api/terminal/yards/{yard.yard_id}/toggle-status/', {}, **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        yard.refresh_from_db()
        self.assertEqual(yard.yard_status, 'INACTIVE')
        self.assertFalse(yard.is_operational)

        # Toggle back to ACTIVE
        response = self.client.post(f'/api/terminal/yards/{yard.yard_id}/toggle-status/', {}, **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        yard.refresh_from_db()
        self.assertEqual(yard.yard_status, 'ACTIVE')
        self.assertTrue(yard.is_operational)

    # =========================================================================
    # YARD BLOCK TESTS
    # =========================================================================

    def test_create_yard_block_success(self):
        yard = Yard.objects.create(
            yard_name="North Yard",
            yard_code="CY-NORTH",
            yard_type="CONTAINER_YARD",
            yard_capacity=500
        )
        payload = {
            "yard_block_code": "B01",
            "yard_block_name": "Standard Block 1",
            "yard_block_type": "STANDARD",
            "yard_block_capacity": 60,
            "yard_block_occupied": 15
        }
        response = self.client.post(f'/api/terminal/yards/{yard.yard_id}/blocks/', payload, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        data = response.data['data']
        self.assertEqual(data['yard_block_code'], 'B01')
        self.assertEqual(data['yard_id'], yard.yard_id)
        self.assertEqual(data['available_capacity'], 45)
        self.assertEqual(data['occupancy_percentage'], 25.0)

        # Block belongs to yard
        block = YardBlock.objects.get(yard_block_id=data['yard_block_id'])
        self.assertEqual(block.yard_block_yard_id, yard)

    def test_create_yard_block_duplicate_code_in_same_yard(self):
        yard = Yard.objects.create(
            yard_name="Yard A",
            yard_code="YD-A",
            yard_type="CONTAINER_YARD",
            yard_capacity=200
        )
        YardBlock.objects.create(
            yard_block_yard_id=yard,
            yard_block_code="A01",
            yard_block_name="Block A01",
            yard_block_capacity=50
        )
        payload = {
            "yard_block_code": "A01",
            "yard_block_name": "Duplicate Block A01",
            "yard_block_capacity": 50
        }
        response = self.client.post(f'/api/terminal/yards/{yard.yard_id}/blocks/', payload, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('yard_block_code', response.data['errors'])

    def test_create_yard_block_same_code_in_different_yard(self):
        yard_a = Yard.objects.create(yard_name="Yard A", yard_code="YD-A", yard_type="CONTAINER_YARD", yard_capacity=200)
        yard_b = Yard.objects.create(yard_name="Yard B", yard_code="YD-B", yard_type="CONTAINER_YARD", yard_capacity=200)

        YardBlock.objects.create(yard_block_yard_id=yard_a, yard_block_code="B01", yard_block_name="Block B01 in A", yard_block_capacity=50)

        # Creating B01 in Yard B must succeed
        payload = {
            "yard_block_code": "B01",
            "yard_block_name": "Block B01 in B",
            "yard_block_capacity": 50
        }
        response = self.client.post(f'/api/terminal/yards/{yard_b.yard_id}/blocks/', payload, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_block_capacity_and_occupancy_validation(self):
        yard = Yard.objects.create(yard_name="Yard A", yard_code="YD-A", yard_type="CONTAINER_YARD", yard_capacity=200)
        # Capacity zero
        response = self.client.post(f'/api/terminal/yards/{yard.yard_id}/blocks/', {
            "yard_block_code": "B02",
            "yard_block_name": "Zero Cap Block",
            "yard_block_capacity": 0
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Occupied exceeds capacity
        response = self.client.post(f'/api/terminal/yards/{yard.yard_id}/blocks/', {
            "yard_block_code": "B03",
            "yard_block_name": "Overflow Block",
            "yard_block_capacity": 30,
            "yard_block_occupied": 40
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_toggle_yard_block_status(self):
        yard = Yard.objects.create(yard_name="Yard A", yard_code="YD-A", yard_type="CONTAINER_YARD", yard_capacity=200)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="B01", yard_block_name="Block B01", yard_block_capacity=50)

        response = self.client.post(f'/api/terminal/blocks/{block.yard_block_id}/toggle-status/', {}, **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        block.refresh_from_db()
        self.assertEqual(block.yard_block_status, 'INACTIVE')
        self.assertFalse(block.is_operational)

    def test_block_in_inactive_yard_not_operational(self):
        yard = Yard.objects.create(yard_name="Yard Inactive", yard_code="YD-INACT", yard_type="CONTAINER_YARD", yard_status="INACTIVE", yard_capacity=200)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="B01", yard_block_name="Active Block in Inactive Yard", yard_block_status="ACTIVE", yard_block_capacity=50)

        # Even though block status is ACTIVE, because its yard is INACTIVE, is_operational must be False
        self.assertFalse(block.is_operational)

    # =========================================================================
    # YARD SLOT TESTS
    # =========================================================================

    def test_create_yard_slot_success(self):
        yard = Yard.objects.create(yard_name="Yard A", yard_code="YD-A", yard_type="CONTAINER_YARD", yard_capacity=200)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="A01", yard_block_name="Block A01", yard_block_capacity=50)

        payload = {
            "yard_slot_row": 1,
            "yard_slot_bay": 2,
            "yard_slot_tier": 3,
            "yard_slot_status": "AVAILABLE"
        }
        response = self.client.post(f'/api/terminal/blocks/{block.yard_block_id}/slots/', payload, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data['data']
        self.assertEqual(data['yard_slot_row'], 1)
        self.assertEqual(data['yard_slot_bay'], 2)
        self.assertEqual(data['yard_slot_tier'], 3)
        self.assertEqual(data['yard_slot_code'], "A01-R01-B02-T03")
        self.assertEqual(data['yard_slot_status'], "AVAILABLE")
        self.assertTrue(data['is_allocatable'])

    def test_create_yard_slot_invalid_row_bay_tier(self):
        yard = Yard.objects.create(yard_name="Yard A", yard_code="YD-A", yard_type="CONTAINER_YARD", yard_capacity=200)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="A01", yard_block_name="Block A01", yard_block_capacity=50)

        # Row 0
        response = self.client.post(f'/api/terminal/blocks/{block.yard_block_id}/slots/', {
            "yard_slot_row": 0, "yard_slot_bay": 1, "yard_slot_tier": 1
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Bay 0
        response = self.client.post(f'/api/terminal/blocks/{block.yard_block_id}/slots/', {
            "yard_slot_row": 1, "yard_slot_bay": 0, "yard_slot_tier": 1
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Tier 0
        response = self.client.post(f'/api/terminal/blocks/{block.yard_block_id}/slots/', {
            "yard_slot_row": 1, "yard_slot_bay": 1, "yard_slot_tier": 0
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_yard_slot_duplicate_code_in_same_block(self):
        yard = Yard.objects.create(yard_name="Yard A", yard_code="YD-A", yard_type="CONTAINER_YARD", yard_capacity=200)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="A01", yard_block_name="Block A01", yard_block_capacity=50)

        YardSlot.objects.create(
            yard_slot_block_id=block,
            yard_slot_code="A01-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1
        )

        response = self.client.post(f'/api/terminal/blocks/{block.yard_block_id}/slots/', {
            "yard_slot_code": "A01-R01-B01-T01",
            "yard_slot_row": 1,
            "yard_slot_bay": 1,
            "yard_slot_tier": 1
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('yard_slot_code', response.data['errors'])

    def test_slot_status_toggle_and_allocatability(self):
        yard = Yard.objects.create(yard_name="Yard A", yard_code="YD-A", yard_type="CONTAINER_YARD", yard_capacity=200)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="A01", yard_block_name="Block A01", yard_block_capacity=50)
        slot = YardSlot.objects.create(
            yard_slot_block_id=block,
            yard_slot_code="A01-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="AVAILABLE"
        )
        self.assertTrue(slot.is_allocatable)

        # Toggle to BLOCKED
        response = self.client.post(f'/api/terminal/slots/{slot.yard_slot_id}/toggle-status/', {"yard_slot_status": "BLOCKED"}, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.yard_slot_status, "BLOCKED")
        self.assertFalse(slot.is_allocatable)

        # Change to INACTIVE
        response = self.client.post(f'/api/terminal/slots/{slot.yard_slot_id}/toggle-status/', {"yard_slot_status": "INACTIVE"}, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.yard_slot_status, "INACTIVE")
        self.assertFalse(slot.is_allocatable)

    # =========================================================================
    # RBAC TESTS
    # =========================================================================

    def test_rbac_terminal_operator_full_access(self):
        # Create yard
        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "TLO Yard", "yard_code": "CY-TLO", "yard_type": "CONTAINER_YARD", "yard_capacity": 100
        }, format='json', **self.headers_tlo)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rbac_port_administrator_full_access(self):
        # Port Admin can create yard
        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "Admin Yard", "yard_code": "CY-ADM", "yard_type": "CONTAINER_YARD", "yard_capacity": 100
        }, format='json', **self.headers_admin)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rbac_port_operations_officer_read_only(self):
        yard = Yard.objects.create(yard_name="Ops Yard", yard_code="CY-OPS", yard_type="CONTAINER_YARD", yard_capacity=100)

        # GET is allowed
        response = self.client.get('/api/terminal/yards/', **self.headers_ops)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.get(f'/api/terminal/yards/{yard.yard_id}/', **self.headers_ops)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # POST is denied
        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "Disallowed Yard", "yard_code": "CY-NOPS", "yard_type": "CONTAINER_YARD", "yard_capacity": 100
        }, format='json', **self.headers_ops)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rbac_shipping_company_denied(self):
        response = self.client.get('/api/terminal/yards/', **self.headers_shipping)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.post('/api/terminal/yards/', {
            "yard_name": "Denied Yard", "yard_code": "CY-DEN", "yard_type": "CONTAINER_YARD", "yard_capacity": 100
        }, format='json', **self.headers_shipping)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rbac_customs_officer_denied(self):
        response = self.client.get('/api/terminal/yards/', **self.headers_customs)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rbac_gate_officer_denied(self):
        response = self.client.get('/api/terminal/yards/', **self.headers_gate)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # OCCUPANCY INTEGRITY & SAFETY TESTS
    # =========================================================================

    def test_occupied_slot_cannot_be_manually_toggled(self):
        """Reject changing an OCCUPIED slot to AVAILABLE, BLOCKED, or INACTIVE while an active allocation exists."""
        from decimal import Decimal
        yard = Yard.objects.create(yard_name="Yard Test", yard_code="YD-TST", yard_type="CONTAINER_YARD", yard_capacity=100)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="B01", yard_block_name="Block B01", yard_block_capacity=50)
        slot = YardSlot.objects.create(
            yard_slot_block_id=block,
            yard_slot_code="B01-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="OCCUPIED"
        )
        cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival,
            cargo_description="Test Cargo",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("1.00"),
            cargo_weight=Decimal("20.00")
        )
        container = Container.objects.create(
            container_cargo_id=cargo,
            container_number="TSTU1234567",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AT_TERMINAL"
        )
        YardAllocation.objects.create(
            yard_allocation_container_id=container,
            yard_allocation_slot_id=slot,
            yard_allocation_status='ACTIVE'
        )

        # 1. Attempt toggle without body (default toggle) -> 400 Bad Request
        res_toggle = self.client.post(f'/api/terminal/slots/{slot.yard_slot_id}/toggle-status/', {}, format='json', **self.headers_tlo)
        self.assertEqual(res_toggle.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("OCCUPIED", res_toggle.data['message'])

        # 2. Attempt explicit change to AVAILABLE -> 400 Bad Request
        res_avail = self.client.post(f'/api/terminal/slots/{slot.yard_slot_id}/toggle-status/', {"yard_slot_status": "AVAILABLE"}, format='json', **self.headers_tlo)
        self.assertEqual(res_avail.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Attempt PATCH to AVAILABLE -> 400 Bad Request
        res_patch = self.client.patch(f'/api/terminal/slots/{slot.yard_slot_id}/', {"yard_slot_status": "AVAILABLE"}, format='json', **self.headers_tlo)
        self.assertEqual(res_patch.status_code, status.HTTP_400_BAD_REQUEST)

        slot.refresh_from_db()
        self.assertEqual(slot.yard_slot_status, 'OCCUPIED')

    def test_unallocated_slot_cannot_be_set_to_occupied_manually(self):
        """Reject setting an unallocated slot to OCCUPIED via toggle or patch without an active allocation."""
        yard = Yard.objects.create(yard_name="Yard Test 2", yard_code="YD-TST2", yard_type="CONTAINER_YARD", yard_capacity=100)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="B02", yard_block_name="Block B02", yard_block_capacity=50)
        slot = YardSlot.objects.create(
            yard_slot_block_id=block,
            yard_slot_code="B02-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="AVAILABLE"
        )

        # Attempt to toggle/set status to OCCUPIED without an active allocation
        res = self.client.post(f'/api/terminal/slots/{slot.yard_slot_id}/toggle-status/', {"yard_slot_status": "OCCUPIED"}, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot manually set Slot", res.data['message'])

        slot.refresh_from_db()
        self.assertEqual(slot.yard_slot_status, 'AVAILABLE')

    def test_empty_unallocated_slot_can_become_available(self):
        """An empty, unallocated slot can be toggled between AVAILABLE and BLOCKED."""
        yard = Yard.objects.create(yard_name="Yard Test 3", yard_code="YD-TST3", yard_type="CONTAINER_YARD", yard_capacity=100)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="B03", yard_block_name="Block B03", yard_block_capacity=50)
        slot = YardSlot.objects.create(
            yard_slot_block_id=block,
            yard_slot_code="B03-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="BLOCKED"
        )

        res = self.client.post(f'/api/terminal/slots/{slot.yard_slot_id}/toggle-status/', {"yard_slot_status": "AVAILABLE"}, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.yard_slot_status, 'AVAILABLE')

    def test_block_and_yard_with_active_allocation_cannot_be_deactivated(self):
        """Reject deactivating a block or yard when containers remain actively allocated there."""
        from decimal import Decimal
        yard = Yard.objects.create(yard_name="Yard Test 4", yard_code="YD-TST4", yard_type="CONTAINER_YARD", yard_capacity=100)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="B04", yard_block_name="Block B04", yard_block_capacity=50)
        slot = YardSlot.objects.create(
            yard_slot_block_id=block,
            yard_slot_code="B04-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="OCCUPIED"
        )
        cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival,
            cargo_description="Test Cargo 4",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("1.00"),
            cargo_weight=Decimal("20.00")
        )
        container = Container.objects.create(
            container_cargo_id=cargo,
            container_number="TSTU9999999",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AT_TERMINAL"
        )
        YardAllocation.objects.create(
            yard_allocation_container_id=container,
            yard_allocation_slot_id=slot,
            yard_allocation_status='ACTIVE'
        )

        # Deactivate Block -> 400 Bad Request
        res_block = self.client.post(f'/api/terminal/blocks/{block.yard_block_id}/toggle-status/', {"yard_block_status": "INACTIVE"}, format='json', **self.headers_tlo)
        self.assertEqual(res_block.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot deactivate Block", res_block.data['message'])

        # Deactivate Yard -> 400 Bad Request
        res_yard = self.client.post(f'/api/terminal/yards/{yard.yard_id}/toggle-status/', {"yard_status": "INACTIVE"}, format='json', **self.headers_tlo)
        self.assertEqual(res_yard.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot deactivate Yard", res_yard.data['message'])

    def test_deleting_slot_with_active_allocation_is_rejected(self):
        """Reject deleting a slot while an active allocation exists."""
        from decimal import Decimal
        yard = Yard.objects.create(yard_name="Yard Test 5", yard_code="YD-TST5", yard_type="CONTAINER_YARD", yard_capacity=100)
        block = YardBlock.objects.create(yard_block_yard_id=yard, yard_block_code="B05", yard_block_name="Block B05", yard_block_capacity=50)
        slot = YardSlot.objects.create(
            yard_slot_block_id=block,
            yard_slot_code="B05-R01-B01-T01",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="OCCUPIED"
        )
        cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival,
            cargo_description="Test Cargo 5",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("1.00"),
            cargo_weight=Decimal("20.00")
        )
        container = Container.objects.create(
            container_cargo_id=cargo,
            container_number="TSTU8888888",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AT_TERMINAL"
        )
        YardAllocation.objects.create(
            yard_allocation_container_id=container,
            yard_allocation_slot_id=slot,
            yard_allocation_status='ACTIVE'
        )

        res = self.client.delete(f'/api/terminal/slots/{slot.yard_slot_id}/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(YardSlot.objects.filter(pk=slot.yard_slot_id).exists())
