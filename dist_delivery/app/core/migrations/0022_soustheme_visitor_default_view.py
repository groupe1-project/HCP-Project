from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_remove_soustheme_generated_flat_table_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='soustheme',
            name='visitor_default_view',
            field=models.CharField(default='horizontal', help_text='Vue par défaut du tableau visiteur', max_length=20),
        ),
    ]
