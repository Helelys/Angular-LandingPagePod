import { Component } from '@angular/core';
import { TextsComponent } from "../texts/texts.component";

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [TextsComponent],
  templateUrl: './hero-banner.component.html',
  styleUrl: './hero-banner.component.css'
})
export class HeroBannerComponent {

}
