<?php
defined('ABSPATH') || exit;

/** Resolve site links through WordPress, including subdirectory installations. */
function bkw_page_url($key) {
    if ($key === 'index') {
        return home_url('/');
    }
    $page = get_page_by_path($key);
    return $page ? get_permalink($page) : home_url('/' . $key . '/');
}

// The prototype renders the original markup, without WordPress blocks.
// Keep plugin hooks available, but do not add unused core block styling.
add_action('wp_enqueue_scripts', function () {
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('wp-block-library-theme');
    wp_dequeue_style('global-styles');
    wp_dequeue_style('classic-theme-styles');
}, 100);

/** Explicit page-template assignments also work with existing production slugs. */
add_filter('theme_page_templates', function ($templates) {
    foreach (array('index' => 'Startseite', 'projekte' => 'Projekte',
        'mitgliedschaft' => 'Mitgliedschaft', 'sponsoren' => 'Sponsoren',
        'impressum' => 'Impressum', 'datenschutz' => 'Datenschutz') as $key => $title) {
        $templates['bkw-' . $key . '.php'] = 'BK West: ' . $title;
    }
    return $templates;
});

add_filter('template_include', function ($template) {
    $keys = array('index', 'projekte', 'mitgliedschaft', 'sponsoren', 'impressum', 'datenschutz');
    $key = '';
    if (is_front_page()) {
        $key = 'index';
    } elseif (is_page()) {
        $assigned = get_page_template_slug();
        foreach ($keys as $candidate) {
            if ($assigned === 'bkw-' . $candidate . '.php') {
                $key = $candidate;
                break;
            }
        }
        if (!$key) {
            $slug = get_post_field('post_name', get_queried_object_id());
            if (in_array($slug, $keys, true)) {
                $key = $slug;
            }
        }
    }
    return $key ? get_theme_file_path('/views/' . $key . '.php') : $template;
});
