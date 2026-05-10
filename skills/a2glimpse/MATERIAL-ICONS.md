---
title: a2glimpse Iconography Cheatsheet — Material Symbols Outlined
date: 2026-05-09
type: reference
description: Curated quick-reference of common Material Symbols Outlined ligature names for use with the A2UI v0.8 Icon component, organized by agent intent rather than alphabetically. Lets a coding agent pick the right glyph by use case without web-fetching the Google Fonts catalog.
tags: [a2glimpse, iconography, material-symbols, reference]
---

# Material Symbols — Quick Reference for a2glimpse

The a2glimpse binary ships with `MaterialSymbolsOutlined.woff2` (the full ~3000-glyph Outlined catalog, weight 400) bundled adjacent to the renderer. The vendored Lit `Icon` component looks up glyphs by their **snake_case ligature name**.

**Three rules:**

1. **Use snake_case.** `bug_report`, not `bugReport`. `check_circle`, not `checkCircle`. The renderer does auto-snake-case CamelCase as a fallback, but write snake_case at the source so the JSONL log reads cleanly.
2. **The full catalog is bundled.** Anything documented at <https://fonts.google.com/icons> (Outlined style) works. This file is a curated quick-pick; it is not exhaustive.
3. **Wire shape:**
   ```json
   {"id":"chk","component":{"Icon":{"name":{"literalString":"check_circle"}}}}
   ```
   `name` is an A2UI `StringValue` — `{"literalString":"..."}` for static, `{"path":"/..."}` for bound. Bare strings will not validate.

If a name renders as the literal text instead of a glyph, you mistyped it (the font's `font-display: block` falls back to the ligature key). Re-check spelling against fonts.google.com/icons.

---

## Status / feedback

check · check_circle · check_circle_outline · close · cancel · do_not_disturb · block · error · error_outline · warning · warning_amber · info · help · help_outline · done · done_all · pending · pending_actions · schedule · hourglass_empty · hourglass_top · sync · sync_problem · sync_disabled · cloud_done · cloud_off · cloud_sync · cloud_upload · cloud_download · priority_high · report · report_problem · new_releases · verified · gpp_good · gpp_bad · radio_button_checked · radio_button_unchecked

## Code / dev

code · code_off · terminal · bug_report · build · build_circle · construction · settings_suggest · merge · merge_type · fork_right · fork_left · commit · difference · pull_request · source · data_object · data_array · token · api · webhook · http · https · function · variables · indeterminate_check_box · keyboard_command_key · integration_instructions

## File / IO

folder · folder_open · folder_shared · folder_zip · create_new_folder · drive_file_move · description · article · note · note_add · insert_drive_file · file_present · file_copy · save · save_as · save_alt · upload · upload_file · download · download_for_offline · cloud_upload · cloud_download · attach_file · attachment · link · link_off · open_in_new · open_in_full · close_fullscreen · backup · restore · history

## Navigation / arrows

arrow_back · arrow_forward · arrow_upward · arrow_downward · arrow_back_ios · arrow_forward_ios · chevron_left · chevron_right · expand_more · expand_less · unfold_more · unfold_less · first_page · last_page · north · south · east · west · north_east · north_west · south_east · south_west · close · menu · menu_open · home · arrow_drop_down · arrow_drop_up · keyboard_arrow_left · keyboard_arrow_right · double_arrow

## Data / objects

dataset · table_chart · table_view · table_rows · view_list · view_module · view_column · grid_view · grid_on · schema · account_tree · hub · device_hub · storage · database · memory · key · key_off · vpn_key · lock · lock_open · lock_outline · search · search_off · find_in_page · filter_list · filter_alt · sort · swap_vert · swap_horiz · category · label · bookmark · bookmark_border · tag · numbers

## Communication

chat · chat_bubble · chat_bubble_outline · message · forum · sms · email · mail · mail_outline · drafts · markunread · outbox · inbox · move_to_inbox · send · reply · reply_all · forward · notifications · notifications_active · notifications_off · notifications_none · campaign · share · ios_share · phone · call · call_end · contact_support · support_agent

## Media / playback

play_arrow · play_circle · pause · pause_circle · stop · stop_circle · skip_next · skip_previous · fast_forward · fast_rewind · replay · replay_10 · replay_30 · forward_10 · forward_30 · shuffle · repeat · repeat_one · volume_up · volume_down · volume_mute · volume_off · mic · mic_off · mic_none · videocam · videocam_off · camera_alt · image · photo · movie · headphones · graphic_eq

## Editing

edit · edit_note · edit_off · content_copy · content_paste · content_cut · delete · delete_outline · delete_forever · undo · redo · format_bold · format_italic · format_underlined · format_strikethrough · format_align_left · format_align_center · format_align_right · format_align_justify · format_list_bulleted · format_list_numbered · format_quote · format_size · format_color_text · format_color_fill · text_fields · title · spellcheck · find_replace · checklist · add · add_circle · remove · remove_circle · clear

## People / accounts

person · person_outline · person_add · person_remove · group · group_add · groups · people · people_alt · account_circle · account_box · manage_accounts · admin_panel_settings · supervisor_account · login · logout · how_to_reg · badge · contacts · face · sentiment_satisfied · sentiment_dissatisfied · sentiment_neutral

## Misc utility

settings · settings_applications · settings_suggest · tune · more_vert · more_horiz · drag_handle · drag_indicator · fullscreen · fullscreen_exit · zoom_in · zoom_out · zoom_in_map · zoom_out_map · refresh · cached · update · power_settings_new · visibility · visibility_off · star · star_border · star_outline · favorite · favorite_border · thumb_up · thumb_down · flag · light_mode · dark_mode · palette · brush · auto_awesome · bolt · whatshot · rocket_launch · trending_up · trending_down · trending_flat · timeline · analytics · insights · query_stats · monitoring
