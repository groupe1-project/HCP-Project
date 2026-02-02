# Generated migration for adding is_visible to Categorie

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_categorie_soustheme_categorie'),
    ]

    operations = [
        migrations.AddField(
            model_name='categorie',
            name='is_visible',
            field=models.BooleanField(default=True),
        ),
    ]
