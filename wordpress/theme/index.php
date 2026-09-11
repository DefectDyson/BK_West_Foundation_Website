<?php defined('ABSPATH') || exit; ?>
<!doctype html><html <?php language_attributes(); ?> data-theme="dark"><head>
<meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?php echo esc_html(wp_get_document_title()); ?></title>
<link rel="stylesheet" href="<?php echo esc_url(get_theme_file_uri('/assets/site-pages.css')); ?>">
<?php wp_head(); ?></head><body><?php wp_body_open(); ?>
<main class="section"><div class="wrap">
<?php if (have_posts() && !is_404()) : while (have_posts()) : the_post(); ?>
<h1 class="display"><?php the_title(); ?></h1><?php the_content(); ?>
<?php endwhile; else : ?>
<h1 class="display">Seite nicht gefunden</h1>
<?php endif; ?>
<p><a href="<?php echo esc_url(home_url('/')); ?>">Zur Startseite</a></p>
</div></main><?php wp_footer(); ?></body></html>
