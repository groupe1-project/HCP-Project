from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0029_theme_category_soustheme_ar_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='theme',
            name='couverture_text',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='couverture_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='definition_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='indication_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='periodicite_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='source_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='unite_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='couverture_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='definition_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='indication_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='periodicite_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='source_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='unite_text_ar',
            field=models.TextField(blank=True, null=True),
        ),
    ]