from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0020_user_must_change_password'),
    ]

    operations = [
        migrations.RenameField(
            model_name='user',
            old_name='must_change_password',
            new_name='user_must_change_password',
        ),
    ]
