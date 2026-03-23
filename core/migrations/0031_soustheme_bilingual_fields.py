from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0030_theme_soustheme_metadata_ar_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='soustheme',
            name='data_is_bilingual',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='data_json_i18n',
            field=models.JSONField(blank=True, default=dict, help_text='Donnees canoniques bilingues (fr/ar)'),
        ),
    ]
