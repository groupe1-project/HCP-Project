from django.db import migrations, models


def forwards_convert_avance_to_saisisseur(apps, schema_editor):
    CustomUser = apps.get_model('core', 'CustomUser')
    UserRequest = apps.get_model('core', 'UserRequest')

    CustomUser.objects.filter(role='AVANCE').update(role='SAISISSEUR')
    UserRequest.objects.filter(requested_role='AVANCE').update(requested_role='SAISISSEUR')


def backwards_convert_saisisseur_to_avance(apps, schema_editor):
    # No safe inverse because we cannot know which SAISISSEUR were originally AVANCE.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_sitecontent'),
    ]

    operations = [
        migrations.RunPython(
            forwards_convert_avance_to_saisisseur,
            backwards_convert_saisisseur_to_avance,
        ),
        migrations.AlterField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[('ADMIN', 'Administrateur'), ('SAISISSEUR', 'Saisisseur')],
                default='SAISISSEUR',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='userrequest',
            name='requested_role',
            field=models.CharField(
                choices=[('ADMIN', 'Administrateur'), ('SAISISSEUR', 'Saisisseur')],
                max_length=20,
            ),
        ),
    ]
