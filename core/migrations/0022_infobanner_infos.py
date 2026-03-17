from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_remove_avance_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='infobanner',
            name='infos',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
