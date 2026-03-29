from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_remove_avance_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitecontent',
            name='about_text_ar',
            field=models.TextField(default='تُيسر هذه المنصة الجهوية الولوج إلى الإحصائيات الترابية وعرض المؤشرات ونشر المعلومات الموثوقة لدعم القرار العمومي.'),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='about_title_ar',
            field=models.CharField(default='حول المنصة', max_length=255),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='contact_address_ar',
            field=models.TextField(default='المديرية الجهوية للمندوبية السامية للتخطيط\nبني ملال - خنيفرة'),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='contact_hours_ar',
            field=models.CharField(default='الاثنين - الجمعة، 08:30 - 16:30', max_length=255),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='contact_title_ar',
            field=models.CharField(default='اتصل بنا', max_length=255),
        ),
        migrations.AddField(
            model_name='sitecontent',
            name='useful_links_ar',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
