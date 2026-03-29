from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_soustheme_visitor_default_view'),
    ]

    operations = [
        migrations.AddField(
            model_name='theme',
            name='theme_image',
            field=models.TextField(blank=True, null=True),
        ),
    ]
