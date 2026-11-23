package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import kotlin.math.absoluteValue

/** Keep visited sections alive without loading unseen screens or their network data. */
@Composable
internal fun MainSectionsPager(
    state: PagerState,
    userScrollEnabled: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable (Int) -> Unit,
) {
    var openedPages by remember(state) { mutableIntStateOf(1 shl state.currentPage) }

    HorizontalPager(
        state = state,
        modifier = modifier.fillMaxSize(),
        key = { it },
        userScrollEnabled = userScrollEnabled,
        // There are only four root sections. Retaining visited compositions preserves
        // scroll, entry drafts and Progress's loaded data across long tab jumps.
        beyondViewportPageCount = state.pageCount - 1,
    ) { index ->
        val visible by remember(state, index) {
            derivedStateOf {
                ((state.currentPage - index) + state.currentPageOffsetFraction).absoluteValue < 1f
            }
        }
        val opened = openedPages and (1 shl index) != 0
        if (visible && !opened) SideEffect { openedPages = openedPages or (1 shl index) }

        Box(
            Modifier.fillMaxSize().graphicsLayer {
                val distance = ((state.currentPage - index) + state.currentPageOffsetFraction)
                    .absoluteValue.coerceIn(0f, 1f)
                alpha = 1f - distance * 0.12f
                scaleX = 1f - distance * 0.015f
                scaleY = 1f - distance * 0.015f
            },
        ) {
            if (visible || opened) content(index)
        }
    }
}
