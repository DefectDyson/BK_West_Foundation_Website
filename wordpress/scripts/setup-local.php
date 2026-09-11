<?php
// Run only via CLI in the isolated local container; no production import path.
if (PHP_SAPI !== 'cli' || !getenv('BK_PREVIEW_ADMIN_PASSWORD')) {
    exit(1);
}
define('WP_INSTALLING', true);
require '/var/www/html/wp-load.php';
if (wp_get_environment_type() !== 'local' || !defined('WP_HOME') || WP_HOME !== 'http://localhost:8766') {
    fwrite(STDERR, "Refusing setup outside the local preview.\n");
    exit(1);
}
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
// Suppress installation email even in environments with a configured mailer.
add_filter('pre_wp_mail', '__return_true');
if (!is_blog_installed()) {
    wp_install('BK West Foundation – lokale Vorschau', 'bk-preview', 'preview@example.invalid', false, '', getenv('BK_PREVIEW_ADMIN_PASSWORD'), 'de_DE');
}
update_option('blog_public', 0);
update_option('permalink_structure', '/%postname%/');
update_option('timezone_string', 'Europe/Berlin');
switch_theme('bk-west-foundation');
$pages = array('index' => 'Startseite', 'projekte' => 'Projekte', 'mitgliedschaft' => 'Mitgliedschaft', 'sponsoren' => 'Partner & Sponsoring', 'impressum' => 'Impressum', 'datenschutz' => 'Datenschutz');
foreach ($pages as $slug => $title) {
    $existing = get_page_by_path($slug);
    $id = $existing ? $existing->ID : wp_insert_post(array('post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $title), true);
    if (is_wp_error($id)) {
        exit($id->get_error_message());
    }
    update_post_meta($id, '_wp_page_template', 'bkw-' . $slug . '.php');
    if ($slug === 'index') {
        update_option('show_on_front', 'page');
        update_option('page_on_front', $id);
    }
}
// Let the next request reload rewrite rules after the permalink option change.
delete_option('rewrite_rules');
file_put_contents(ABSPATH . '.htaccess', "# BEGIN WordPress\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteBase /\nRewriteRule ^index\\.php$ - [L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.php [L]\n</IfModule>\n# END WordPress\n");
echo 'Local WordPress ' . get_bloginfo('version') . ": six preview pages, theme active, search indexing disabled.\n";
