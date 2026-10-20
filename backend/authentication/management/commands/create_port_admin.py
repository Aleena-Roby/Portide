import getpass
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email, ValidationError
from django.contrib.auth.hashers import make_password
from django.db import transaction
from authentication.models import Login, User

class Command(BaseCommand):
    help = 'Creates the initial Port Administrator account securely via terminal prompt or command arguments.'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Port Administrator Email')
        parser.add_argument('--password', type=str, help='Port Administrator Password')
        parser.add_argument('--full-name', type=str, help='Port Administrator Full Name', default=None)
        parser.add_argument('--phone', type=str, help='Port Administrator Phone', default=None)
        parser.add_argument('--reset', action='store_true', help='Update password and details if account already exists')

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=== Create Initial Port Administrator Account ==='))

        # 1. Email
        raw_email = options.get('email')
        if not raw_email:
            raw_email = input('Enter Port Administrator Email: ').strip()
        
        if not raw_email:
            raise CommandError('Email address cannot be empty.')

        email = raw_email.lower().strip()

        try:
            validate_email(email)
        except ValidationError:
            raise CommandError(f'"{raw_email}" is not a valid email address.')

        existing_login = Login.objects.filter(login_email=email).first()
        if existing_login and not options.get('reset'):
            raise CommandError(f'An account with email "{email}" already exists. Use --reset to update its password and details.')

        # 2. Full Name
        full_name = options.get('full_name')
        if not full_name:
            if existing_login and hasattr(existing_login, 'profile'):
                default_name = existing_login.profile.user_full_name
            else:
                default_name = 'Port Administrator'
            try:
                full_name = input(f'Enter Port Administrator Full Name [Default: {default_name}]: ').strip()
            except (EOFError, OSError):
                full_name = default_name
            if not full_name:
                full_name = default_name

        # 3. Phone
        phone = options.get('phone')
        if phone is None:
            try:
                phone_input = input('Enter Port Administrator Phone [Optional]: ').strip()
                phone = phone_input if phone_input else None
            except (EOFError, OSError):
                phone = None

        # 4. Password
        password = options.get('password')
        if not password:
            password = getpass.getpass('Enter Port Administrator Password: ')
            password_confirm = getpass.getpass('Confirm Password: ')
            if password != password_confirm:
                raise CommandError('Passwords do not match.')

        if not password:
            raise CommandError('Password cannot be empty.')

        # 5. Create or Update Login and User Records within an Atomic Transaction
        try:
            with transaction.atomic():
                if existing_login:
                    existing_login.login_password = make_password(password)
                    existing_login.login_status = 'ACTIVE'
                    existing_login.login_is_active = True
                    existing_login.save()
                    login_obj = existing_login

                    profile = getattr(login_obj, 'profile', None)
                    if profile:
                        if full_name:
                            profile.user_full_name = full_name
                        if phone:
                            profile.user_phone = phone
                        profile.user_status = 'ACTIVE'
                        profile.save()
                    else:
                        User.objects.create(
                            login_id=login_obj,
                            shipping_company_id=None,
                            user_full_name=full_name or 'Port Administrator',
                            user_phone=phone,
                            user_designation='Port Administrator',
                            user_status='ACTIVE'
                        )
                    self.stdout.write(self.style.SUCCESS(f'\nSuccessfully updated Port Administrator account for "{email}"!'))
                else:
                    login_obj = Login.objects.create(
                        login_email=email,
                        login_password=make_password(password),
                        login_role='port_administrator',
                        login_status='ACTIVE',
                        login_is_active=True
                    )

                    User.objects.create(
                        login_id=login_obj,
                        shipping_company_id=None,
                        user_full_name=full_name,
                        user_phone=phone,
                        user_designation='Port Administrator',
                        user_status='ACTIVE'
                    )
                    self.stdout.write(self.style.SUCCESS(f'\nSuccessfully created Port Administrator account for "{email}"!'))
                    self.stdout.write(self.style.SUCCESS(f'Linked profile created for "{full_name}" (Role: port_administrator).'))

        except Exception as e:
            raise CommandError(f'Failed to create Port Administrator account: {str(e)}')

