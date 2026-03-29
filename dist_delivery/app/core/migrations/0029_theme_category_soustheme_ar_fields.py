from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0028_merge_0022_infobanner_infos_0027_sitecontent_ar_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='categorie',
            name='nom_ar',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='soustheme',
            name='nom_ar',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='theme',
            name='titre_ar',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
    ]
