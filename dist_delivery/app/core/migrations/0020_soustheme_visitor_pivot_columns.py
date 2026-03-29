"""Generated migration to add visitor_pivot_columns field (restored).

This file was recreated because it was removed but the database had already applied
the migration, causing Django to error on startup. Restoring the migration file
matches the applied state.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_soustheme_generated_flat_table_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='soustheme',
            name='visitor_pivot_columns',
            field=models.JSONField(blank=True, default=list, help_text='Colonnes que le visiteur peut pivoter/transposer'),
        ),
    ]
