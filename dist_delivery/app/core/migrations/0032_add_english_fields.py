from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0031_soustheme_bilingual_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='categorie',
            name='nom_en',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='about_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='about_title_en',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='contact_address_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='contact_hours_en',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='contact_title_en',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='useful_links_en',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='couverture_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='definition_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='indication_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='nom_en',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='periodicite_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='source_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='unite_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='couverture_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='definition_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='indication_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='periodicite_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='source_text_en',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='titre_en',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='unite_text_en',
            field=models.TextField(blank=True, null=True),
        ),
    ]
